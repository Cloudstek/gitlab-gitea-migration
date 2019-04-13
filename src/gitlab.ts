import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';

export interface GitLabOptions {
    /** GitLAb instance url without trailing slash */
    url: string;
    /** GitLab API token */
    token: string;
}

export interface GitLabProject {
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
            const response = await this.http.get('/projects');

            let projects: GitLabProject[] = [];

            for (let project of response.data) {
                projects.push({
                    name: project.name,
                    fullName: project.name_with_namespace,
                    description: project.description,
                    path: project.path,
                    namespacePath: project.namespace.full_path,
                    fullPath: project.path_with_namespace,
                    httpUrl: project.http_url_to_repo
                });
            }

            return projects;
        } catch (ex) {
            console.error(chalk.redBright('Error: Could not fetch projects from GitLab instance. ' + ex.message));

            return [];
        }
    }
}
