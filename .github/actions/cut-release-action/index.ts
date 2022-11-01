import * as core from '@actions/core';
import * as github from '@actions/github';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types';

const targetBranch = `release`;
const targetBranchRef = `heads/${targetBranch}`;

const trunkBranch = `main`;
const trunkBranchRef = `heads/${trunkBranch}`;

const getTargetBranchLastCommit = async (octokit: Api, owner: string, repo: string) => {
    try {
        core.info(JSON.stringify({
            owner,
            repo,
            ref: targetBranchRef
        }, null, '  '));
        const res = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: targetBranchRef
        });

        core.info(JSON.stringify(res, null, '  '));

        if (res.status !== 200) {
            core.info(`getTargetBranchLastCommit failed with ${res.status}`);
            return null;
        }

        return res.data.object.sha;
    } catch (e) {
        // do nothing
        core.info((e as Error).message);
    }

    return null;
}

const getTrunkBranchLastCommit = async (octokit: Api, owner: string, repo: string) => {
    try {
        core.info(JSON.stringify({
            owner,
            repo,
            ref: trunkBranchRef
        }, null, '  '));
        const res = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: trunkBranchRef
        });

        core.info(JSON.stringify(res, null, '  '));

        if (res.status !== 200) {
            core.info(`getTrunkBranchLastCommit failed with ${res.status}`);
            return null;
        }

        return res.data.object.sha;
    } catch (e) {
        // do nothing
        core.info((e as Error).message);
    }

    return null;
}

const deleteTargetBranch = async (octokit: Api, owner: string, repo: string) => {
    await octokit.rest.git.deleteRef({
        owner,
        repo,
        ref: targetBranchRef
    });
}

const createTargetBranch = async (
    octokit: Api, 
    owner: string, 
    repo: string,
    trunkLastCommit: string
) => {
    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/${targetBranchRef}`,
        sha: trunkLastCommit
    });
}

const restoreTargetBranch = async (
    octokit: Api, 
    owner: string, 
    repo: string,
    targetLastCommit: string
) => {
    try {
        await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/${targetBranchRef}`,
            sha: targetLastCommit
        });
    } catch (err) {
        // do nothing
    }
}

(async () => {
    if (process.env.GITHUB_TOKEN == null) {
        return;
    }
    try {
        // Get authenticated GitHub client 
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });

        // Create the branch
        core.info(`Creating branch ${targetBranch}`);

        const oldRevCommit = await getTargetBranchLastCommit(
            octokit,
            repo,
            owner
        );

        const trunkLastCommit = await getTrunkBranchLastCommit(
            octokit,
            repo,
            owner
        );

        if (trunkLastCommit == null) {
            throw new Error("Can't fetch info for trunk branch. Please re-start.");
        }

        if (oldRevCommit != null) {
            await deleteTargetBranch(
                octokit,
                repo,
                owner
            );
        }

        try {
            await createTargetBranch(
                octokit,
                repo,
                owner,
                trunkLastCommit,
            )
        } catch (err) {
            if (oldRevCommit != null) {
                await restoreTargetBranch(
                    octokit,
                    repo,
                    owner,
                    oldRevCommit,
                )

                throw new Error(`Couldn't create ${targetBranch}, because of ${(err as Error).message}. Trying to restore old one.`)
            }
            throw new Error(`Couldn't create ${targetBranch}, because of ${(err as Error).message}.`)
        }

        // Set the output
        core.setOutput('branch_url', `https://github.com/${owner}/${repo}/tree/${targetBranch}`);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('Unknown error');
        }
    }
})();
