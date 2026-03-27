const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("PoolManager Contract", function () {
    let poolManager;
    let elfToken;
    let easyToken;
    let mockPool1;
    let mockPool2;
    let owner;
    let user1;
    let user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy ELF and Easy tokens
        const ELFToken = await ethers.getContractFactory("ELFToken");
        elfToken = await ELFToken.deploy();
        
        const EasyToken = await ethers.getContractFactory("EasyToken");
        easyToken = await EasyToken.deploy(0);
        
        // Deploy pool manager
        const PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy(elfToken.address, easyToken.address);
        
        // Create mock pools (using actual pool contract for testing)
        const SimplePriceHelper = await ethers.getContractFactory("SimplePriceHelper");
        const priceHelper = await SimplePriceHelper.deploy();
        
        const Pool = await ethers.getContractFactory("Pool");
        mockPool1 = await Pool.deploy(poolManager.address, priceHelper.address);
        mockPool2 = await Pool.deploy(poolManager.address, priceHelper.address);
    });

    describe("Pool Management", function () {
        it("Should add pools successfully", async function () {
            await poolManager.addPool(mockPool1.address);
            
            const isValidPool = await poolManager.isValidPool(mockPool1.address);
            expect(isValidPool).to.be.true;
            
            const poolCount = await poolManager.getPoolCount();
            expect(poolCount).to.equal(1);
        });

        it("Should not allow duplicate pool addition", async function () {
            await poolManager.addPool(mockPool1.address);
            
            await expect(
                poolManager.addPool(mockPool1.address)
            ).to.be.revertedWith("Pool already exists");
        });

        it("Should remove pools successfully", async function () {
            await poolManager.addPool(mockPool1.address);
            await poolManager.addPool(mockPool2.address);
            
            expect(await poolManager.getPoolCount()).to.equal(2);
            
            await poolManager.removePool(mockPool1.address);
            
            expect(await poolManager.getPoolCount()).to.equal(1);
            expect(await poolManager.isValidPool(mockPool1.address)).to.be.false;
            expect(await poolManager.isValidPool(mockPool2.address)).to.be.true;
        });

        it("Should not allow removal of non-existent pool", async function () {
            await expect(
                poolManager.removePool(mockPool1.address)
            ).to.be.revertedWith("Pool not found");
        });

        it("Should only allow owner to add/remove pools", async function () {
            await expect(
                poolManager.connect(user1).addPool(mockPool1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
            
            await poolManager.addPool(mockPool1.address);
            
            await expect(
                poolManager.connect(user1).removePool(mockPool1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("ELF Token Management", function () {
        beforeEach(async function () {
            await poolManager.addPool(mockPool1.address);
            await elfToken.transferOwnership(poolManager.address);
        });

        it("Should mint ELF tokens for liquidity providers", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await poolManager.mintELF(user1.address, mintAmount);
            
            const balance = await elfToken.balanceOf(user1.address);
            expect(balance).to.equal(mintAmount);
        });

        it("Should burn ELF tokens when removing liquidity", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("500");
            
            await poolManager.mintELF(user1.address, mintAmount);
            
            // User needs to approve pool manager to burn their tokens
            await elfToken.connect(user1).approve(poolManager.address, burnAmount);
            
            await poolManager.burnELF(user1.address, burnAmount);
            
            const balance = await elfToken.balanceOf(user1.address);
            expect(balance).to.equal(mintAmount.sub(burnAmount));
        });

        it("Should only allow valid pools to mint/burn ELF", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            // Non-pool should not be able to mint
            await expect(
                poolManager.connect(user1).mintELF(user1.address, mintAmount)
            ).to.be.revertedWith("Only valid pools can call this");
        });
    });

    describe("EASY Token Management", function () {
        beforeEach(async function () {
            await poolManager.addPool(mockPool1.address);
            await easyToken.transferOwnership(poolManager.address);
        });

        it("Should mint EASY tokens as rewards", async function () {
            const rewardAmount = ethers.parseEther("100");
            
            await poolManager.mintEasyReward(user1.address, rewardAmount);
            
            const balance = await easyToken.balanceOf(user1.address);
            expect(balance).to.equal(rewardAmount);
        });

        it("Should track total rewards distributed", async function () {
            const reward1 = ethers.parseEther("100");
            const reward2 = ethers.parseEther("200");
            
            await poolManager.mintEasyReward(user1.address, reward1);
            await poolManager.mintEasyReward(user2.address, reward2);
            
            const totalRewards = await poolManager.getTotalEasyRewards();
            expect(totalRewards).to.equal(reward1.add(reward2));
        });

        it("Should only allow valid pools to mint rewards", async function () {
            const rewardAmount = ethers.parseEther("100");
            
            await expect(
                poolManager.connect(user1).mintEasyReward(user1.address, rewardAmount)
            ).to.be.revertedWith("Only valid pools can call this");
        });
    });

    describe("Pool Information", function () {
        beforeEach(async function () {
            await poolManager.addPool(mockPool1.address);
            await poolManager.addPool(mockPool2.address);
        });

        it("Should return correct pool count", async function () {
            const count = await poolManager.getPoolCount();
            expect(count).to.equal(2);
        });

        it("Should return pool address by index", async function () {
            const pool0 = await poolManager.getPoolByIndex(0);
            const pool1 = await poolManager.getPoolByIndex(1);
            
            expect(pool0).to.equal(mockPool1.address);
            expect(pool1).to.equal(mockPool2.address);
        });

        it("Should revert when accessing invalid pool index", async function () {
            await expect(
                poolManager.getPoolByIndex(5)
            ).to.be.reverted;
        });

        it("Should return all pool addresses", async function () {
            const pools = await poolManager.getAllPools();
            expect(pools.length).to.equal(2);
            expect(pools[0]).to.equal(mockPool1.address);
            expect(pools[1]).to.equal(mockPool2.address);
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow owner to pause/unpause", async function () {
            // This would depend on if you implement pause functionality
            // For now, just test basic ownership functions
            
            const currentOwner = await poolManager.owner();
            expect(currentOwner).to.equal(owner.address);
        });

        it("Should allow ownership transfer", async function () {
            await poolManager.transferOwnership(user1.address);
            
            const newOwner = await poolManager.owner();
            expect(newOwner).to.equal(user1.address);
        });
    });
});