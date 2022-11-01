"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
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
        // do nothing
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
        // do nothing
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
        // do nothing
    }
};
async function run() {
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
        // Set the output
        core.setOutput('branch_url', `https://github.com/${owner}/${repo}/tree/${targetBranch}`);
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('Unknown error');
        }
    }
}
module.exports = run;
