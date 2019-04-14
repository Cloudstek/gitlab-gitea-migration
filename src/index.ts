#!/usr/bin/env node

import chalk from 'chalk';
import program from 'commander';
import inquirer, { Answers } from 'inquirer';
import cliProgress from 'cli-progress';

import { Gitea } from './gitea';
import { GitLab, GitLabProject } from './gitlab';

(async function() {
    program
        .name('gitlab-gitea-migration')
        .version('1.0.0')
        .description('Migrate GitLab repositories to Gitea.')
        .arguments('<gitlab-url> <gitea-url>')
        .option('-lu, --lab-user <user>', 'GitLab username/email')
        .option('-lt, --lab-token <token>', 'GitLab API token')
        .option('-tt, --tea-token <token>', 'gitea API token')
        .parse(process.argv);

    if (program.args.length !== 2) {
        program.outputHelp();
        process.exit(0);
    }

    let prompt: Answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'labUser',
            message: 'GitLab Username?',
            when: () => !program.labUser
        },
        {
            type: 'password',
            name: 'labToken',
            message: 'GitLab API token?',
            when: () => !program.labToken
        },
        {
            type: 'password',
            name: 'teaToken',
            message: 'Gitea API token?',
            when: () => !program.teaToken
        }
    ]);

    program.labUser = program.labUser || prompt.labUser;
    program.labToken = program.labToken || prompt.labToken;
    program.teaToken = program.teaToken || prompt.teaToken;

    // Create GitLab API instance
    const lab = new GitLab({
        url: program.args[0],
        token: program.labToken
    });

    // Create Gitea API instance
    const tea = new Gitea({
        url: program.args[1],
        token: program.teaToken,
        gitlabUsername: program.labUser,
        gitlabToken: program.labToken
    });

    // List projects and prompt which to export
    let projects = await lab.listProjects();

    if (projects === undefined || projects.length === 0) {
        console.log('No projects found to migrate.');
        return;
    }

    // List possible owners
    let owners = await tea.listOwners();

    prompt = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'projects',
            message: 'Please select the GitLab projects to migrate:',
            pageSize: 15,
            choices: () => {
                return projects.map(project => {
                    return {
                        name: project.fullName,
                        value: project
                    }
                });
            },
            validate: (value) => {
                return value.length > 0;
            }
        },
        {
            type: 'list',
            name: 'owner',
            message: 'Please select the owner of the migrated repository:',
            pageSize: 10,
            choices: () => {
                return owners.map(owner => {
                    return {
                        name: owner.name,
                        value: owner
                    }
                });
            },
            validate: (value) => {
                return value.length > 0;
            }
        },
        {
            type: 'confirm',
            name: 'continue',
            message: (answers: Answers) => {
                let numProjects = answers.projects.length;

                return `Are you sure you want to migrate ${numProjects} project(s)?`;
            }
        }
    ]);

    if (prompt.continue === false) {
        return;
    }

    // Change list of projects to selected list
    projects = prompt.projects;

    // Migrate projects
    console.log();
    tea.migrate(projects, prompt.owner, new cliProgress.Bar({}, cliProgress.Presets.shades_classic));
})();
