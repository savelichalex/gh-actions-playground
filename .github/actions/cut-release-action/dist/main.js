import * as core from '@actions/core';
import * as github from '@actions/github';
const targetBranch = `release`;
const targetBranchRef = `heads/${targetBranch}`;
const trunkBranch = `main`;
const trunkBranchRef = `heads/${trunkBranch}`;
const getTargetBranchLastCommit = async (octokit, owner, repo) => {
    try {
        const res = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: targetBranchRef
        });
        if (res.status !== 200) {
            return null;
        }
        return res.data.object.sha;
    }
    catch (e) {
    }
    return null;
};
const getTrunkBranchLastCommit = async (octokit, owner, repo) => {
    try {
        const res = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: trunkBranchRef
        });
        if (res.status !== 200) {
            return null;
        }
        return res.data.object.sha;
    }
    catch (e) {
    }
    return null;
};
const deleteTargetBranch = async (octokit, owner, repo) => {
    await octokit.rest.git.deleteRef({
        owner,
        repo,
        ref: targetBranchRef
    });
};
const createTargetBranch = async (octokit, owner, repo, trunkLastCommit) => {
    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/${targetBranchRef}`,
        sha: trunkLastCommit
    });
};
const restoreTargetBranch = async (octokit, owner, repo, targetLastCommit) => {
    try {
        await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/${targetBranchRef}`,
            sha: targetLastCommit
        });
    }
    catch (err) {
    }
};
async function run() {
    if (process.env.GITHUB_TOKEN == null) {
        return;
    }
    try {
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        core.info(`Creating branch ${targetBranch}`);
        const oldRevCommit = await getTargetBranchLastCommit(octokit, repo, owner);
        const trunkLastCommit = await getTrunkBranchLastCommit(octokit, repo, owner);
        if (trunkLastCommit == null) {
            throw new Error("Can't fetch info for trunk branch. Please re-start.");
        }
        if (oldRevCommit != null) {
            await deleteTargetBranch(octokit, repo, owner);
        }
        try {
            await createTargetBranch(octokit, repo, owner, trunkLastCommit);
        }
        catch (err) {
            if (oldRevCommit != null) {
                await restoreTargetBranch(octokit, repo, owner, oldRevCommit);
                throw new Error(`Couldn't create ${targetBranch}, because of ${err.message}. Trying to restore old one.`);
            }
            throw new Error(`Couldn't create ${targetBranch}, because of ${err.message}.`);
        }
        core.setOutput('branch_url', `https://github.com/${owner}/${repo}/tree/${targetBranch}`);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
module.exports = run;
