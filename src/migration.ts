import { GitLab, GitLabProject, GitLabKey } from "./gitlab";
import { Gitea, GiteaOwnerInfo } from "./gitea";
import cliProgress from 'cli-progress';
import { isBoolean, isArray } from "util";
import chalk from 'chalk';

export interface MigrationOptions {
    /** Optional progress bar */
    progressBar?: cliProgress.Bar | boolean;
}

export interface MigrationResult {
    success: GitLabProject[];
    skipped: GitLabProject[];
    failed: GitLabProject[];
    errors: string[];
}

/**
 * GitLab to Gitea migration
 *
 * @param gitlab
 * @param gitea
 * @param options
 */
export class Migration {
    gitlab: GitLab;
    gitea: Gitea;
    options: MigrationOptions;
    progressBar: cliProgress.Bar | undefined;

    constructor(gitlab: GitLab, gitea: Gitea, options: MigrationOptions) {
        this.gitlab = gitlab;
        this.gitea = gitea;
        this.options = options;

        if (options.progressBar) {
            if (isBoolean(options.progressBar) && options.progressBar === true) {
                this.progressBar = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);
            }

            if (options.progressBar instanceof cliProgress.Bar) {
                this.progressBar = options.progressBar;
            }
        }
    }

    /**
     * Migrate GitLab projects
     *
     * @param  projects    List of projects
     * @param  owner       Gitea repository owner
     * @param  progressBar Progress bar
     *
     * @return Promise<MigrationResult>
     */
    async migrateProjects(projects: GitLabProject[], owner: GiteaOwnerInfo): Promise<MigrationResult> {
        // HTTP requests
        let migrations = [];

        // Successfully migrated projects
        let result: MigrationResult = {
            success: [],
            skipped: [],
            failed: [],
            errors: []
        };

        if (this.progressBar) {
            this.progressBar.start(projects.length, 0);
        }

        for (let project of projects) {
            // Gitea repository name
            let repoName = this.repoName(project);

            migrations.push(
                this.gitea.http
                    .post('/repos/migrate', {
                        auth_username: this.gitlab.username,
                        auth_password: this.gitlab.token,
                        clone_addr: project.httpUrl,
                        description: project.description,
                        mirror: true,
                        private: project.visibility !== 'public',
                        repo_name: repoName,
                        uid: owner.id
                    })
                    .then(() => {
                        result.success.push(project);
                    })
                    .catch(async (response) => {
                        if (response.response.status === 409) {
                            result.skipped.push(project);
                            return;
                        }

                        let errorMessage = response.response.data.message || '';

                        result.errors.push(
                            chalk.redBright(`Failed to migrate ${owner.username}/${repoName} from ${project.httpUrl}:`) +
                            `\n  Error ${response.response.status} ${response.response.statusText} ${errorMessage}`
                        );

                        result.failed.push(project);
                    })
                    .finally(async () => {
                        if (this.progressBar) {
                            this.progressBar.increment(1);
                        }
                    })
            );
        }

        await Promise.all(migrations);

        if (this.progressBar) {
            this.progressBar.stop();
            console.log();
        }

        return result;
    }

    /**
     * Migrate GitLab project keys
     *
     * @param  projects    List of projects
     * @param  owner       Gitea repository owner
     * @param  progressBar Progress bar
     */
    async migrateKeys(projects: GitLabProject[], owner: GiteaOwnerInfo): Promise<MigrationResult> {
        // Migrate keys
        let migrations = [];

        // Successfully migrated projects
        let result: MigrationResult = {
            success: [],
            skipped: [],
            failed: [],
            errors: []
        };

        if (this.progressBar) {
            this.progressBar.start(projects.length, 0);
        }

        for (let project of projects) {
            // Gitea repository name
            let repoName = this.repoName(project);

            // Project keys
            let keys: GitLabKey[] = [];

            // Fetch project keys
            await this.gitlab.http
                .get(`/projects/${project.id}/deploy_keys`)
                .then(response => {
                    for (let key of response.data) {
                        keys.push({
                            id: key.id,
                            title: key.title,
                            key: key.key,
                            readOnly: key.can_push === false
                        });
                    }
                })
                .catch(response => {
                    let errorMessage = response.response.data.message || '';
                    let repoName = this.repoName(project);

                    result.errors.push(
                        chalk.redBright(`Failed to migrate keys for ${owner.username}/${repoName} from ${project.httpUrl}:`) +
                        `\n  Error ${response.response.status} ${response.response.statusText} ${errorMessage}`
                    );

                    result.failed.push(project);
                });

            // Continue because of error
            if (keys.length === 0) {
                if (this.progressBar) {
                    this.progressBar.increment(1);
                }

                continue;
            }

            for (let key of keys) {
                migrations.push(
                    this.gitea.http
                        .post(`/repos/${owner.username}/${repoName}/keys`, {
                            title: key.title,
                            key: key.key,
                            read_only: key.readOnly
                        })
                        .then(() => {
                            result.success.push(project);
                        })
                        .catch(response => {
                            if (response.response.status === 422) {
                                result.skipped.push(project);
                                return;
                            }

                            let errorMessage = response.response.data.message || '';
                            let repoName = this.repoName(project);

                            result.errors.push(
                                chalk.redBright(`Failed to migrate keys for ${owner.username}/${repoName} from ${project.httpUrl}:`) +
                                `\n  Error ${response.response.status} ${response.response.statusText} ${errorMessage}`
                            );

                            result.failed.push(project);
                        })
                );
            }

            if (this.progressBar) {
                this.progressBar.increment(1);
            }
        }

        await Promise.all(migrations);

        if (this.progressBar) {
            this.progressBar.stop();
            console.log();
        }

        return result;
    }

    /**
     * Convert GitLab project name to Gitea project name
     *
     * @param  project
     *
     * @return Project name
     */
    repoName(project: GitLabProject): string {
        return project.fullPath.substr(project.fullPath.indexOf('/') + 1).replace('/', '-');
    }
}
