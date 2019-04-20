import axios, { AxiosInstance } from 'axios';

export interface GiteaOptions {
    /** Gitea instance url without trailing slash */
    url: string;
    /** Gitea API token */
    token: string;
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
    http: AxiosInstance;

    constructor(options: GiteaOptions) {
        this.http = axios.create({
            baseURL: options.url + '/api/v1',
            headers: {
                'Authorization': 'token ' + options.token
            }
        });
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
}
