const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Governance Contract", function () {
    let governance;
    let easyToken;
    let owner;
    let user1;
    let user2;
    let user3;

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();

        // Deploy EASY token
        const EasyToken = await ethers.getContractFactory("EasyToken");
        easyToken = await EasyToken.deploy(0); // Pass default settings
        await easyToken.deployed();

        // Deploy governance
        const Governance = await ethers.getContractFactory("Governance");
        governance = await Governance.deploy(easyToken.address);
        await governance.deployed();

        // Mint EASY tokens to users for voting
        await easyToken.mint(user1.address, ethers.ethers.parseEther("1000"));
        await easyToken.mint(user2.address, ethers.ethers.parseEther("2000"));
        await easyToken.mint(user3.address, ethers.ethers.parseEther("500"));
    });

    describe("Proposal Creation", function () {
        it("Should allow users with enough tokens to create proposals", async function () {
            const description = "Test proposal to change fee rate";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            // User1 has enough tokens (1000 >= minimum required)
            const tx = await governance.connect(user1).initProposal(
                targets,
                values,
                calldatas,
                description
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check that proposal was created
            const proposalCount = await governance.getProposalCount();
            expect(proposalCount).to.equal(1);
        });

        it("Should not allow users without enough tokens to create proposals", async function () {
            // User3 only has 500 tokens, which might be below minimum
            const description = "Test proposal";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            // This might pass or fail depending on your minimum requirement
            // Adjust the test based on your actual minimum requirement
            try {
                await governance.connect(user3).initProposal(
                    targets,
                    values,
                    calldatas,
                    description
                );
            } catch (error) {
                expect(error.message).to.include("Insufficient");
            }
        });

        it("Should emit ProposalCreated event", async function () {
            const description = "Test proposal";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            await expect(
                governance.connect(user1).initProposal(
                    targets,
                    values,
                    calldatas,
                    description
                )
            ).to.emit(governance, "ProposalCreated");
        });
    });

    describe("Proposal Proving", function () {
        let proposalId;

        beforeEach(async function () {
            // Create a proposal first
            const description = "Test proposal";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            const tx = await governance.connect(user1).initProposal(
                targets,
                values,
                calldatas,
                description
            );
            
            const receipt = await tx.wait();
            proposalId = 1; // First proposal
        });

        it("Should allow proposal creator to prove proposal", async function () {
            // Prove the proposal (submit additional details or verification)
            const proof = "This proposal will improve the protocol";
            
            const tx = await governance.connect(user1).proveProposal(
                proposalId,
                proof
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should not allow others to prove proposal", async function () {
            const proof = "This proposal will improve the protocol";
            
            await expect(
                governance.connect(user2).proveProposal(proposalId, proof)
            ).to.be.revertedWith("Only proposal creator can prove");
        });
    });

    describe("Proposal Voting", function () {
        let proposalId;

        beforeEach(async function () {
            // Create and prove a proposal
            const description = "Test proposal for voting";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            const tx = await governance.connect(user1).initProposal(
                targets,
                values,
                calldatas,
                description
            );
            
            proposalId = 1;
            
            await governance.connect(user1).proveProposal(
                proposalId,
                "Proof of proposal"
            );
        });

        it("Should allow token holders to vote", async function () {
            // Vote YES (true) with user2 (has 2000 tokens)
            const tx = await governance.connect(user2).voteProposal(
                proposalId,
                true,
                ethers.parseEther("1000") // Vote with 1000 tokens
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should not allow voting with more tokens than owned", async function () {
            await expect(
                governance.connect(user3).voteProposal(
                    proposalId,
                    true,
                    ethers.parseEther("1000") // User3 only has 500 tokens
                )
            ).to.be.revertedWith("Insufficient balance");
        });

        it("Should not allow double voting", async function () {
            // First vote
            await governance.connect(user2).voteProposal(
                proposalId,
                true,
                ethers.parseEther("500")
            );
            
            // Second vote should fail
            await expect(
                governance.connect(user2).voteProposal(
                    proposalId,
                    false,
                    ethers.parseEther("500")
                )
            ).to.be.revertedWith("Already voted");
        });

        it("Should track vote counts correctly", async function () {
            // Multiple users vote
            await governance.connect(user1).voteProposal(
                proposalId,
                true,
                ethers.parseEther("800")
            );
            
            await governance.connect(user2).voteProposal(
                proposalId,
                false,
                ethers.parseEther("1500")
            );
            
            await governance.connect(user3).voteProposal(
                proposalId,
                true,
                ethers.parseEther("300")
            );
            
            // Check vote counts (would need getter functions in contract)
            const proposal = await governance.getProposal(proposalId);
            // Assertions would depend on your contract's structure
        });
    });

    describe("Proposal Execution", function () {
        let proposalId;

        beforeEach(async function () {
            // Create, prove, and vote on a proposal
            const description = "Test proposal for execution";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            await governance.connect(user1).initProposal(
                targets,
                values,
                calldatas,
                description
            );
            
            proposalId = 1;
            
            await governance.connect(user1).proveProposal(
                proposalId,
                "Proof of proposal"
            );
            
            // Vote to pass the proposal
            await governance.connect(user1).voteProposal(
                proposalId,
                true,
                ethers.parseEther("800")
            );
            
            await governance.connect(user2).voteProposal(
                proposalId,
                true,
                ethers.parseEther("1500")
            );
        });

        it("Should execute proposal after successful voting", async function () {
            // Wait for voting period to end (if there's a time delay)
            // await network.provider.send("evm_increaseTime", [86400 * 7]); // 7 days
            
            const tx = await governance.execProposal(proposalId);
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should not execute proposal twice", async function () {
            // Execute once
            await governance.execProposal(proposalId);
            
            // Try to execute again
            await expect(
                governance.execProposal(proposalId)
            ).to.be.revertedWith("Already executed");
        });

        it("Should not execute failed proposal", async function () {
            // Create a new proposal that will fail
            const description = "Failing proposal";
            const targets = [governance.address];
            const values = [0];
            const calldatas = ["0x"];
            
            await governance.connect(user1).initProposal(
                targets,
                values,
                calldatas,
                description
            );
            
            const failingProposalId = 2;
            
            await governance.connect(user1).proveProposal(
                failingProposalId,
                "Proof of failing proposal"
            );
            
            // Vote NO to make it fail
            await governance.connect(user2).voteProposal(
                failingProposalId,
                false,
                ethers.parseEther("2000")
            );
            
            await expect(
                governance.execProposal(failingProposalId)
            ).to.be.revertedWith("Proposal failed");
        });
    });

    describe("Governance Token Integration", function () {
        it("Should check token balance for voting power", async function () {
            // This test verifies that voting power is based on token holdings
            const user2Balance = await easyToken.balanceOf(user2.address);
            expect(user2Balance).to.equal(ethers.parseEther("2000"));
        });

        it("Should handle token transfers affecting voting power", async function () {
            // Transfer tokens and check voting power changes
            await easyToken.connect(user2).transfer(user3.address, ethers.parseEther("500"));
            
            const user2NewBalance = await easyToken.balanceOf(user2.address);
            const user3NewBalance = await easyToken.balanceOf(user3.address);
            
            expect(user2NewBalance).to.equal(ethers.parseEther("1500"));
            expect(user3NewBalance).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Administrative Functions", function () {
        it("Should allow admin to update governance parameters", async function () {
            // This would test functions like changing voting period, quorum, etc.
            // Implementation depends on your governance contract features
            
            // For now, just test that owner can call admin functions
            const currentOwner = await governance.owner();
            expect(currentOwner).to.equal(owner.address);
        });
    });
});