import axios, { AxiosInstance, AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';
import chalk from 'chalk';

export interface GitLabOptions {
    /** GitLAb instance url without trailing slash */
    url: string;
    /** GitLab API token */
    token: string;
}

export interface GitLabProject {
    id: number,
    name: string;
    fullName: string,
    description?: string;
    /** Repository path without namespace */
    path: string;
    /** Path of the namespace */
    namespacePath: string;
    /** Repository path with namespace */
    fullPath: string;
    /** HTTP clone URL of the repository */
    httpUrl: string;
    /** Project visibility */
    visibility: string;
}

/**
 * GitLab API functionality
 */
export class GitLab {
    http: AxiosInstance;

    constructor(options: GitLabOptions) {
        this.http = axios.create({
            baseURL: options.url + '/api/v4',
            headers: {
                'Private-Token': options.token
            },
            responseType: 'json'
        });
    }

    /**
     * List all projects
     */
    async listProjects(): Promise<GitLabProject[]> {
        try {
            const responses = await this.getPaged('/projects');
            let projects: GitLabProject[] = [];

            for (let response of responses) {
                for (let project of response.data) {
                    projects.push({
                        id: project.id,
                        name: project.name,
                        fullName: project.name_with_namespace,
                        description: project.description,
                        path: project.path,
                        namespacePath: project.namespace.full_path,
                        fullPath: project.path_with_namespace,
                        httpUrl: project.http_url_to_repo,
                        visibility: project.visibility
                    });
                }
            }

            projects.sort((a, b) => {
                let aParts = a.fullName.split(' / ');
                let bParts = b.fullName.split(' / ');

                for (let i in aParts) {
                    if ((bParts.length - 1) <  Number.parseInt(i)) {
                        return 1;
                    }

                    if (aParts[i] !== bParts[i]) {
                        return aParts[i].localeCompare(bParts[i]);
                    }
                }

                return 0;
            });

            return projects;
        } catch (ex) {
            console.error(chalk.redBright('Error: Could not fetch projects from GitLab instance. ' + ex.message));

            return [];
        }
    }

    /**
     * Get paged API responses
     *
     * @param  url
     * @param  config
     */
    private async getPaged(url: string, config?: AxiosRequestConfig) {
        let responses: AxiosResponse<any>[] = [];
        let nextPage;

        do {
            let nextUrl = url;

            if (nextPage !== undefined && isNaN(nextPage) === false) {
                const baseUrl = this.http.defaults.baseURL || '';
                let pageUrl = new URL(baseUrl + nextUrl);

                pageUrl.searchParams.set('page', nextPage.toString());

                nextUrl = pageUrl.href.substr(baseUrl.length);
            }

            const response = await this.http.get(nextUrl, config);
            nextPage = Number.parseInt(response.headers['x-next-page']);

            responses.push(response);
        } while(nextPage !== undefined && isNaN(nextPage) === false);

        return responses;
    }
}
