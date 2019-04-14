import axios, { AxiosInstance, AxiosPromise, AxiosResponse, AxiosError } from 'axios';
import { GitLabProject } from './gitlab';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

export interface GiteaOptions {
    /** Gitea instance url without trailing slash */
    url: string;
    /** Gitea API token */
    token: string;
    /** Gitlab username or email */
    gitlabUsername: string;
    /** Gitlab password or API token */
    gitlabToken: string;
}

export interface GiteaMigrateOptions {
    /** HTTP clone url */
    url: string;
    /** Repository name */
    name: string;
    /** Owning organisation/user ID */
    owner?: number;
    /** Repository description */
    description?: string;
    mirror?: boolean;
    private?: boolean;
}

export interface GiteaOwnerInfo {
    id: number;
    name: string;
    username: string,
    email?: string;
}

/**
 * Gitea API
 */
export class Gitea {
    gitlabUsername: string;
    gitlabToken: string;
    http: AxiosInstance;

    constructor(options: GiteaOptions) {
        this.gitlabUsername = options.gitlabUsername;
        this.gitlabToken = options.gitlabToken;

        this.http = axios.create({
            baseURL: options.url + '/api/v1',
            headers: {
                'Authorization': 'token ' + options.token
            }
        });
    }

    /**
     * Migrate GitLab projects
     *
     * @param  projects    List of projects
     * @param  owner       Gitea repository owner
     * @param  progressBar Progress bar
     */
    async migrate(projects: GitLabProject[], owner: GiteaOwnerInfo, progressBar?: cliProgress.Bar) {
        let migrations = [];
        let errors: string[] = [];

        if (progressBar) {
            progressBar.start(projects.length, 0);
        }

        for (let project of projects) {
            let repoName = this.repoName(project);

            migrations.push(
                this.http
                    .post('/repos/migrate', {
                        auth_username: this.gitlabUsername,
                        auth_password: this.gitlabToken,
                        clone_addr: project.httpUrl,
                        description: project.description,
                        mirror: true,
                        private: project.visibility !== 'public',
                        repo_name: repoName,
                        uid: owner.id
                    })
                    .then(async () => {
                        // // Migrate releases
                        // let releaseErrors = await this.migrateReleases(project, owner);
                        //
                        // for (let error of releaseErrors.errors) {
                        //     errors.push(error.message);
                        // }
                    })
                    .catch(async (response) => {
                        if (response.response.status !== 409) {
                            let errorMessage = response.response.data.message || '';

                            errors.push(
                                chalk.redBright(`Failed to migrate ${owner.username}/${repoName} from ${project.httpUrl}:`) +
                                `\n  Error ${response.response.status} ${response.response.statusText} ${errorMessage}`
                            );

                            return;
                        }

                        // if (response.response.status === 409) {
                        //     // Migrate releases
                        //     let releaseErrors = await this.migrateReleases(project, owner);
                        //
                        //     for (let error of releaseErrors.errors) {
                        //         errors.push(error.message);
                        //     }
                        // }
                    })
                    .finally(async () => {
                        if (progressBar) {
                            progressBar.increment(1);
                        }
                    })
            );
        }

        await Promise.all(migrations);

        if (progressBar) {
            progressBar.stop();
            console.log();
        }

        for (let error of errors) {
            console.error(error);
        }
    }

    /**
     * Migrate project releases
     */
    async migrateReleases(project: GitLabProject, owner: GiteaOwnerInfo): Promise<{ errors: Error[] }> {
        try {
            const response = await this.http.get(`/projects/${project.id}/releases`);

            let releases = [];
            let errors: Error[] = [];

            console.log(response.data);

            // for (let release of response.data) {
            //     releases.push(
            //         this.http
            //             .post(`/repos/${owner.username}/${this.repoName(project)}/releases`, {
            //
            //             })
            //             .catch(() => {
            //                 // return response;
            //             })
            //     )
            //
            // }
            //
            // await Promise.all(releases);

            return { errors: errors };
        } catch (ex) {
            return {
                errors: [
                    new Error('Could not fetch list of releases from GitLab instance. ' + ex.message)
                ]
            }
        }
    }

    /**
     * List possible repository owners
     */
    async listOwners(): Promise<GiteaOwnerInfo[]> {
        try {
            const user = this.userInfo();
            const orgs = this.listOrgs();

            return Promise.all([user, orgs]).then(([user, orgs]) => {
                let owners = [user];

                return owners.concat(orgs);
            });
        } catch (ex) {
            throw new Error('Could not fetch list of owners from Gitea instance. ' + ex.message);
        }
    }

    /**
     * Get current user info
     */
    async userInfo(): Promise<GiteaOwnerInfo> {
        try {
            const response = await this.http.get('/user');

            return {
                id: response.data.id,
                email: response.data.email,
                name: response.data.full_name || response.data.username,
                username: response.data.username
            };
        } catch (ex) {
            throw new Error('Could not fetch current user info from Gitea instance. ' + ex.message);
        }
    }

    /**
     * List user organisations
     */
    async listOrgs(): Promise<GiteaOwnerInfo[]> {
        try {
            const response = await this.http.get('/user/orgs');

            let orgs: GiteaOwnerInfo[] = [];

            for (let org of response.data) {
                orgs.push({
                    id: org.id,
                    name: org.username,
                    username: org.username
                });
            }

            return orgs;
        } catch (ex) {
            throw new Error('Could not fetch user organisations from Gitea instance. ' + ex.message);
        }
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
