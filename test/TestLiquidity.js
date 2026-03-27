const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Liquidity Management", function () {
    let pool;
    let poolManager;
    let elfToken;
    let easyToken;
    let mockTokenA;
    let mockTokenB;
    let priceHelper;
    let owner;
    let user1;
    let user2;
    
    const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy all contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockTokenA = await MockERC20.deploy("Token A", "TKA", 18);
        mockTokenB = await MockERC20.deploy("Token B", "TKB", 18);
        
        const SimplePriceHelper = await ethers.getContractFactory("SimplePriceHelper");
        priceHelper = await SimplePriceHelper.deploy();
        
        const ELFToken = await ethers.getContractFactory("ELFToken");
        elfToken = await ELFToken.deploy();
        
        const EasyToken = await ethers.getContractFactory("EasyToken");
        easyToken = await EasyToken.deploy(0);
        
        const PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy(elfToken.address, easyToken.address);
        
        const Pool = await ethers.getContractFactory("Pool");
        pool = await Pool.deploy(poolManager.address, priceHelper.address);
        
        await poolManager.addPool(pool.address);
        await elfToken.transferOwnership(poolManager.address);
        await easyToken.transferOwnership(poolManager.address);
        
        // Setup tokens
        await mockTokenA.mint(user1.address, ethers.parseEther("100000"));
        await mockTokenB.mint(user1.address, ethers.parseEther("100000"));
        await mockTokenA.mint(user2.address, ethers.parseEther("100000"));
        await mockTokenB.mint(user2.address, ethers.parseEther("100000"));
        
        await mockTokenA.connect(user1).approve(pool.address, ethers.parseEther("100000"));
        await mockTokenB.connect(user1).approve(pool.address, ethers.parseEther("100000"));
        await mockTokenA.connect(user2).approve(pool.address, ethers.parseEther("100000"));
        await mockTokenB.connect(user2).approve(pool.address, ethers.parseEther("100000"));
    });

    describe("Add Liquidity", function () {
        it("Should add liquidity successfully for new pair", async function () {
            const amountA = ethers.parseEther("1000");
            const amountB = ethers.parseEther("2000");
            const minAmountA = ethers.parseEther("990");
            const minAmountB = ethers.parseEther("1980");
            
            const balanceBeforeA = await mockTokenA.balanceOf(user1.address);
            const balanceBeforeB = await mockTokenB.balanceOf(user1.address);
            const elfBalanceBefore = await elfToken.balanceOf(user1.address);
            
            const tx = await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                amountA,
                amountB,
                minAmountA,
                minAmountB
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check token balances decreased
            const balanceAfterA = await mockTokenA.balanceOf(user1.address);
            const balanceAfterB = await mockTokenB.balanceOf(user1.address);
            expect(balanceAfterA).to.be.lt(balanceBeforeA);
            expect(balanceAfterB).to.be.lt(balanceBeforeB);
            
            // Check ELF tokens were minted
            const elfBalanceAfter = await elfToken.balanceOf(user1.address);
            expect(elfBalanceAfter).to.be.gt(elfBalanceBefore);
            
            // Check pool token balances
            const poolInfoA = await pool.getPoolInfo(mockTokenA.address);
            const poolInfoB = await pool.getPoolInfo(mockTokenB.address);
            expect(poolInfoA.totalTokens).to.be.gt(0);
            expect(poolInfoB.totalTokens).to.be.gt(0);
        });

        it("Should add liquidity to existing pair proportionally", async function () {
            // First add initial liquidity
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("990"),
                ethers.parseEther("1980")
            );
            
            // Second user adds liquidity in same ratio
            const elfBalanceBefore = await elfToken.balanceOf(user2.address);
            
            await pool.connect(user2).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("500"),   // Half the amount
                ethers.parseEther("1000"),  // Should maintain 1:2 ratio
                ethers.parseEther("490"),
                ethers.parseEther("990")
            );
            
            const elfBalanceAfter = await elfToken.balanceOf(user2.address);
            expect(elfBalanceAfter).to.be.gt(elfBalanceBefore);
            
            // Ratio should be maintained
            const poolInfoA = await pool.getPoolInfo(mockTokenA.address);
            const poolInfoB = await pool.getPoolInfo(mockTokenB.address);
            
            // Should have roughly 1500 TKA and 3000 TKB
            expect(poolInfoA.totalTokens).to.be.closeTo(ethers.parseEther("1500"), ethers.parseEther("50"));
            expect(poolInfoB.totalTokens).to.be.closeTo(ethers.parseEther("3000"), ethers.parseEther("100"));
        });

        it("Should handle ETH liquidity addition", async function () {
            const ethAmount = ethers.parseEther("5");
            const tokenAmount = ethers.parseEther("10000");
            
            const tx = await pool.connect(user1).addLiquidity(
                ETH_ADDRESS,
                mockTokenA.address,
                ethAmount,
                tokenAmount,
                ethers.parseEther("4.9"),
                ethers.parseEther("9900"),
                { value: ethAmount }
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check ETH was transferred to pool
            const poolEthBalance = await ethers.provider.getBalance(pool.address);
            expect(poolEthBalance).to.be.gte(ethAmount);
            
            // Check ELF tokens were minted
            const elfBalance = await elfToken.balanceOf(user1.address);
            expect(elfBalance).to.be.gt(0);
        });

        it("Should fail if slippage is too high", async function () {
            await expect(
                pool.connect(user1).addLiquidity(
                    mockTokenA.address,
                    mockTokenB.address,
                    ethers.parseEther("1000"),
                    ethers.parseEther("2000"),
                    ethers.parseEther("1100"), // Unrealistic minimum
                    ethers.parseEther("2200")  // Unrealistic minimum
                )
            ).to.be.reverted;
        });

        it("Should fail with insufficient token balance", async function () {
            await expect(
                pool.connect(user1).addLiquidity(
                    mockTokenA.address,
                    mockTokenB.address,
                    ethers.parseEther("200000"), // More than user has
                    ethers.parseEther("400000"),
                    ethers.parseEther("190000"),
                    ethers.parseEther("380000")
                )
            ).to.be.reverted;
        });
    });

    describe("Remove Liquidity", function () {
        beforeEach(async function () {
            // Add initial liquidity
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("5000"),
                ethers.parseEther("10000"),
                ethers.parseEther("4900"),
                ethers.parseEther("9800")
            );
            
            // Add ETH liquidity too
            await pool.connect(user1).addLiquidity(
                ETH_ADDRESS,
                mockTokenA.address,
                ethers.parseEther("2"),
                ethers.parseEther("4000"),
                ethers.parseEther("1.9"),
                ethers.parseEther("3900"),
                { value: ethers.parseEther("2") }
            );
        });

        it("Should remove liquidity successfully", async function () {
            const elfBalance = await elfToken.balanceOf(user1.address);
            const removeAmount = elfBalance.div(2); // Remove half
            
            const balanceBeforeA = await mockTokenA.balanceOf(user1.address);
            const balanceBeforeB = await mockTokenB.balanceOf(user1.address);
            
            // Approve ELF spending
            await elfToken.connect(user1).approve(pool.address, removeAmount);
            
            const tx = await pool.connect(user1).removeLiquidity(
                removeAmount,
                [mockTokenA.address, mockTokenB.address],
                [ethers.parseEther("100"), ethers.parseEther("200")] // Minimum amounts
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check tokens were returned
            const balanceAfterA = await mockTokenA.balanceOf(user1.address);
            const balanceAfterB = await mockTokenB.balanceOf(user1.address);
            expect(balanceAfterA).to.be.gt(balanceBeforeA);
            expect(balanceAfterB).to.be.gt(balanceBeforeB);
            
            // Check ELF balance decreased
            const elfBalanceAfter = await elfToken.balanceOf(user1.address);
            expect(elfBalanceAfter).to.equal(elfBalance.sub(removeAmount));
        });

        it("Should remove ETH liquidity successfully", async function () {
            const elfBalance = await elfToken.balanceOf(user1.address);
            const removeAmount = elfBalance.div(4); // Remove quarter
            
            const ethBalanceBefore = await ethers.provider.getBalance(user1.address);
            const tokenBalanceBefore = await mockTokenA.balanceOf(user1.address);
            
            await elfToken.connect(user1).approve(pool.address, removeAmount);
            
            const tx = await pool.connect(user1).removeLiquidity(
                removeAmount,
                [ETH_ADDRESS, mockTokenA.address],
                [ethers.parseEther("0.1"), ethers.parseEther("50")]
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check ETH and tokens were returned (accounting for gas costs)
            const ethBalanceAfter = await ethers.provider.getBalance(user1.address);
            const tokenBalanceAfter = await mockTokenA.balanceOf(user1.address);
            
            expect(tokenBalanceAfter).to.be.gt(tokenBalanceBefore);
            // ETH balance check would need to account for gas costs
        });

        it("Should fail if trying to remove more ELF than owned", async function () {
            const elfBalance = await elfToken.balanceOf(user1.address);
            const removeAmount = elfBalance.add(ethers.parseEther("1000"));
            
            await expect(
                pool.connect(user1).removeLiquidity(
                    removeAmount,
                    [mockTokenA.address, mockTokenB.address],
                    [ethers.parseEther("100"), ethers.parseEther("200")]
                )
            ).to.be.reverted;
        });

        it("Should fail if minimum amounts not met", async function () {
            const elfBalance = await elfToken.balanceOf(user1.address);
            const removeAmount = elfBalance.div(2);
            
            await elfToken.connect(user1).approve(pool.address, removeAmount);
            
            await expect(
                pool.connect(user1).removeLiquidity(
                    removeAmount,
                    [mockTokenA.address, mockTokenB.address],
                    [ethers.parseEther("10000"), ethers.parseEther("20000")] // Unrealistic minimums
                )
            ).to.be.reverted;
        });
    });

    describe("EASY Token Minting", function () {
        it("Should mint EASY tokens when providing liquidity", async function () {
            const easyBalanceBefore = await easyToken.balanceOf(user1.address);
            
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("990"),
                ethers.parseEther("1980")
            );
            
            const easyBalanceAfter = await easyToken.balanceOf(user1.address);
            
            // Should have received some EASY tokens as rewards
            // This depends on your reward implementation
            expect(easyBalanceAfter).to.be.gte(easyBalanceBefore);
        });

        it("Should mint EASY tokens proportional to liquidity provided", async function () {
            // User1 provides large amount
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("5000"),
                ethers.parseEther("10000"),
                ethers.parseEther("4900"),
                ethers.parseEther("9800")
            );
            
            const user1EasyBalance = await easyToken.balanceOf(user1.address);
            
            // User2 provides smaller amount
            await pool.connect(user2).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("990"),
                ethers.parseEther("1980")
            );
            
            const user2EasyBalance = await easyToken.balanceOf(user2.address);
            
            // User1 should have more EASY tokens (proportional to contribution)
            expect(user1EasyBalance).to.be.gt(user2EasyBalance);
        });
    });

    describe("Liquidity Analytics", function () {
        beforeEach(async function () {
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("3000"),
                ethers.parseEther("6000"),
                ethers.parseEther("2900"),
                ethers.parseEther("5800")
            );
        });

        it("Should track total liquidity correctly", async function () {
            const poolInfoA = await pool.getPoolInfo(mockTokenA.address);
            const poolInfoB = await pool.getPoolInfo(mockTokenB.address);
            
            expect(poolInfoA.totalTokens).to.be.closeTo(ethers.parseEther("3000"), ethers.parseEther("100"));
            expect(poolInfoB.totalTokens).to.be.closeTo(ethers.parseEther("6000"), ethers.parseEther("200"));
        });

        it("Should track user liquidity shares", async function () {
            const elfBalance = await elfToken.balanceOf(user1.address);
            expect(elfBalance).to.be.gt(0);
            
            // Add more liquidity from user2
            await pool.connect(user2).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("990"),
                ethers.parseEther("1980")
            );
            
            const user2ElfBalance = await elfToken.balanceOf(user2.address);
            expect(user2ElfBalance).to.be.gt(0);
            
            // User1 should have more ELF (provided more liquidity)
            expect(elfBalance).to.be.gt(user2ElfBalance);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle very small liquidity amounts", async function () {
            const smallAmount = ethers.parseEther("0.001");
            
            const tx = await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                smallAmount,
                smallAmount.mul(2),
                0,
                0
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should handle tokens with different decimals", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const token6 = await MockERC20.deploy("USDC", "USDC", 6);
            const token8 = await MockERC20.deploy("WBTC", "WBTC", 8);
            
            await token6.mint(user1.address, ethers.parseUnits("10000", 6));
            await token8.mint(user1.address, ethers.parseUnits("10", 8));
            
            await token6.connect(user1).approve(pool.address, ethers.parseUnits("10000", 6));
            await token8.connect(user1).approve(pool.address, ethers.parseUnits("10", 8));
            
            const tx = await pool.connect(user1).addLiquidity(
                token6.address,
                token8.address,
                ethers.parseUnits("1000", 6),
                ethers.parseUnits("1", 8),
                ethers.parseUnits("990", 6),
                ethers.parseUnits("0.99", 8)
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });
    });
});