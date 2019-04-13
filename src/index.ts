#!/usr/bin/env node

import chalk from 'chalk';
import program from 'commander';
import inquirer, { Answers } from 'inquirer';

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
    let labProjects = await lab.listProjects();

    if (labProjects === undefined || labProjects.length === 0) {
        console.log('No projects found to migrate.');
        return;
    }

    labProjects.sort((a, b) => {
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

    prompt = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'labProjects',
            message: 'Please select the GitLab projects to migrate:',
            choices: () => {
                return labProjects.map(project => {
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
            type: 'confirm',
            name: 'continue',
            message: (answers: Answers) => {
                let numProjects = answers.labProjects.length;

                return `Are you sure you want to migrate ${numProjects} project(s)?`;
            }
        }
    ]);

    // Change list of projects to selected list
    labProjects = prompt.labProjects;
})();
