import axios, { AxiosInstance } from 'axios';
import url from 'url';
import chalk from 'chalk';

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

export interface GiteaUserInfo {
    id: number;
    email: string;
    name?: string;
}

export interface GiteaOrgInfo {
    id: number;
    name: string;
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

    async migrate(options: GiteaMigrateOptions) {
        try {
            await this.http.post('/repos/migrate', {
                // TODO: Add post data for migration
            });
        } catch (ex) {
            console.error(chalk.redBright('Could not fetch current user info from Gitea instance. ' + ex.message));
            process.exit(1);
        }
    }

    /**
     * Get current user info
     */
    async userInfo(): Promise<GiteaUserInfo | undefined> {
        try {
            const response = await this.http.get('/user');

            return {
                id: response.data.id,
                email: response.data.email,
                name: response.data.full_name
            };
        } catch (ex) {
            console.error(chalk.redBright('Could not fetch current user info from Gitea instance. ' + ex.message));
            process.exit(1);
        }
    }

    /**
     * List user organisations
     */
    async listOrgs(): Promise<GiteaOrgInfo[] | undefined> {
        try {
            const response = await this.http.get('/user/orgs');

            let orgs: GiteaOrgInfo[] = [];

            for (let org of response.data) {
                orgs.push({
                    id: org.id,
                    name: org.username
                });
            }

            return orgs;
        } catch (ex) {
            console.error(chalk.redBright('Could not fetch user organisations from Gitea instance. ' + ex.message));
            process.exit(1);
        }
    }
}
