class EasyDEXApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.contracts = {};
        this.currentTab = 'swap';
        this.selectedFromToken = 'TKA';
        this.selectedToToken = 'TKB';
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setupTabs();
        await this.loadMockData();
        console.log('🚀 EasyDEX App Initialized');
    }
    
    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        
        // Swap functionality
        document.getElementById('reverseSwap').addEventListener('click', () => this.reverseTokens());
        document.getElementById('fromAmount').addEventListener('input', (e) => this.calculateSwapOutput(e.target.value));
        document.getElementById('swapButton').addEventListener('click', () => this.executeSwap());
        
        // Liquidity functionality
        document.getElementById('tokenAAmount').addEventListener('input', (e) => this.calculateLiquidityB(e.target.value));
        document.getElementById('tokenBAmount').addEventListener('input', (e) => this.calculateLiquidityA(e.target.value));
        document.getElementById('addLiquidityButton').addEventListener('click', () => this.addLiquidity());
        
        // Governance functionality
        document.getElementById('createProposalButton').addEventListener('click', () => this.createProposal());
        document.querySelectorAll('.btn-vote-for').forEach(btn => {
            btn.addEventListener('click', (e) => this.vote(e.target.closest('.proposal-card'), true));
        });
        document.querySelectorAll('.btn-vote-against').forEach(btn => {
            btn.addEventListener('click', (e) => this.vote(e.target.closest('.proposal-card'), false));
        });
    }
    
    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });
    }
    
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update active tab pane
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
        
        this.currentTab = tabName;
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }
    
    async loadTabData(tabName) {
        switch(tabName) {
            case 'swap':
                await this.updateSwapInterface();
                break;
            case 'liquidity':
                await this.updateLiquidityInterface();
                break;
            case 'governance':
                await this.updateGovernanceInterface();
                break;
            case 'analytics':
                await this.updateAnalyticsInterface();
                break;
        }
    }
    
    async connectWallet() {
        try {
            if (typeof window.ethereum === 'undefined') {
                alert('Please install MetaMask or another Web3 wallet!');
                return;
            }
            
            this.showLoading('Connecting wallet...');
            
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Initialize provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();
            
            // Switch to local network if needed
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x7A69' }], // 31337 in hex
                });
            } catch (switchError) {
                // Add network if it doesn't exist
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x7A69',
                            chainName: 'Hardhat Local',
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['http://127.0.0.1:8545'],
                        }],
                    });
                }
            }
            
            await this.initContracts();
            await this.updateWalletUI();
            await this.loadUserData();
            
            this.hideLoading();
            this.showNotification('Wallet connected successfully!', 'success');
            
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.hideLoading();
            this.showNotification('Failed to connect wallet: ' + error.message, 'error');
        }
    }
    
    async initContracts() {
        try {
            // Initialize all contract instances
            this.contracts.priceHelper = new ethers.Contract(
                CONTRACT_CONFIG.addresses.PriceHelper,
                CONTRACT_ABIS.PriceHelper,
                this.signer
            );
            
            this.contracts.elfToken = new ethers.Contract(
                CONTRACT_CONFIG.addresses.ELFToken,
                CONTRACT_ABIS.ELFToken,
                this.signer
            );
            
            this.contracts.easyToken = new ethers.Contract(
                CONTRACT_CONFIG.addresses.EasyToken,
                CONTRACT_ABIS.EasyToken,
                this.signer
            );
            
            this.contracts.poolManager = new ethers.Contract(
                CONTRACT_CONFIG.addresses.PoolManager,
                CONTRACT_ABIS.PoolManager,
                this.signer
            );
            
            this.contracts.governance = new ethers.Contract(
                CONTRACT_CONFIG.addresses.Governance,
                CONTRACT_ABIS.Governance,
                this.signer
            );
            
            // Initialize token contracts
            this.contracts.tokens = {};
            Object.keys(TOKENS).forEach(symbol => {
                if (TOKENS[symbol].address) {
                    this.contracts.tokens[symbol] = new ethers.Contract(
                        TOKENS[symbol].address,
                        CONTRACT_ABIS.ERC20,
                        this.signer
                    );
                }
            });
            
            console.log('✅ Contracts initialized');
        } catch (error) {
            console.error('Contract initialization failed:', error);
            throw error;
        }
    }
    
    async updateWalletUI() {
        if (!this.userAddress) return;
        
        // Hide connect button, show wallet info
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        
        // Update wallet address display
        const shortAddress = this.userAddress.slice(0, 6) + '...' + this.userAddress.slice(-4);
        document.getElementById('walletAddress').textContent = shortAddress;
        
        // Update ETH balance
        const ethBalance = await this.provider.getBalance(this.userAddress);
        document.getElementById('ethBalance').textContent = 
            parseFloat(ethers.utils.formatEther(ethBalance)).toFixed(4) + ' ETH';
        
        // Enable swap button
        document.getElementById('swapButton').disabled = false;
        document.getElementById('swapButton').textContent = 'Enter amount';
        
        // Enable liquidity button
        document.getElementById('addLiquidityButton').disabled = false;
        document.getElementById('addLiquidityButton').textContent = 'Enter amounts';
    }
    
    async loadUserData() {
        if (!this.userAddress || !this.contracts.tokens) return;
        
        try {
            // Load token balances
            await this.updateTokenBalances();
            
            // Load user positions
            await this.updateUserPositions();
            
            // Load governance data
            await this.updateUserGovernanceData();
            
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }
    
    async updateTokenBalances() {
        try {
            for (const [symbol, contract] of Object.entries(this.contracts.tokens)) {
                const balance = await contract.balanceOf(this.userAddress);
                const decimals = TOKENS[symbol].decimals;
                const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(4);
                
                // Update UI elements
                const balanceElements = document.querySelectorAll(`#${symbol.toLowerCase()}Balance, #from${symbol}Balance, #to${symbol}Balance, #token${symbol}Balance`);
                balanceElements.forEach(el => {
                    if (el) el.textContent = formattedBalance;
                });
            }
        } catch (error) {
            console.error('Failed to update token balances:', error);
        }
    }
    
    async updateUserPositions() {
        try {
            const elfBalance = await this.contracts.elfToken.balanceOf(this.userAddress);
            const formattedElfBalance = parseFloat(ethers.utils.formatEther(elfBalance)).toFixed(4);
            
            if (parseFloat(formattedElfBalance) > 0) {
                // User has liquidity positions
                document.getElementById('liquidityPositions').innerHTML = `
                    <div class="position-card">
                        <div class="position-header">
                            <h5>TKA/TKB Pool</h5>
                            <span class="position-value">$1,234.56</span>
                        </div>
                        <div class="position-details">
                            <span>ELF Tokens: ${formattedElfBalance}</span>
                            <span>Share: 0.5%</span>
                            <span>Fees Earned: $12.34</span>
                        </div>
                        <button class="btn-outline">Remove Liquidity</button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to update user positions:', error);
        }
    }
    
    async updateUserGovernanceData() {
        try {
            const easyBalance = await this.contracts.easyToken.balanceOf(this.userAddress);
            const formattedBalance = parseFloat(ethers.utils.formatEther(easyBalance)).toFixed(2);
            
            document.getElementById('userEasyBalance').textContent = formattedBalance;
            
            // Calculate voting power (simplified)
            const totalSupply = await this.contracts.easyToken.totalSupply();
            const votingPower = easyBalance.gt(0) ? 
                (parseFloat(ethers.utils.formatEther(easyBalance)) / parseFloat(ethers.utils.formatEther(totalSupply)) * 100).toFixed(2) + '%' : 
                '0%';
            document.getElementById('votingPower').textContent = votingPower;
            
        } catch (error) {
            console.error('Failed to update governance data:', error);
        }
    }
    
    async updateSwapInterface() {
        // Update current algorithm mode
        try {
            // Mock algorithm detection logic
            const mode = Math.random() > 0.3 ? 'Pool Mode' : 'Settings Mode';
            document.getElementById('slippageMode').textContent = mode;
            document.getElementById('algorithmMode').textContent = mode;
            document.getElementById('currentMode').textContent = mode;
        } catch (error) {
            console.error('Failed to update swap interface:', error);
        }
    }
    
    async updateLiquidityInterface() {
        // Update APR and reward rates
        document.getElementById('currentAPR').textContent = '12.5%';
        document.getElementById('easyRewards').textContent = '2.1% APR';
        document.getElementById('rewardRate').textContent = '2.1% APR';
    }
    
    async updateGovernanceInterface() {
        // Governance interface is mostly static for demo
    }
    
    async updateAnalyticsInterface() {
        // Update protocol statistics with mock data
        document.getElementById('totalVolume24h').textContent = '$1,234,567';
        document.getElementById('totalFees24h').textContent = '$3,704';
        document.getElementById('totalTransactions').textContent = '2,156';
        document.getElementById('totalTVL').textContent = '$5,234,567';
        document.getElementById('totalPools').textContent = '3';
    }
    
    reverseTokens() {
        const temp = this.selectedFromToken;
        this.selectedFromToken = this.selectedToToken;
        this.selectedToToken = temp;
        
        // Update UI
        this.updateTokenSelectUI();
        
        // Recalculate swap
        const fromAmount = document.getElementById('fromAmount').value;
        if (fromAmount) {
            this.calculateSwapOutput(fromAmount);
        }
    }
    
    updateTokenSelectUI() {
        const fromToken = TOKENS[this.selectedFromToken];
        const toToken = TOKENS[this.selectedToToken];
        
        // Update from token
        const fromTokenEl = document.getElementById('fromToken');
        fromTokenEl.querySelector('img').src = fromToken.logo;
        fromTokenEl.querySelector('span').textContent = fromToken.symbol;
        
        // Update to token
        const toTokenEl = document.getElementById('toToken');
        toTokenEl.querySelector('img').src = toToken.logo;
        toTokenEl.querySelector('span').textContent = toToken.symbol;
        
        // Update balances
        this.updateTokenBalances();
    }
    
    async calculateSwapOutput(inputAmount) {
        if (!inputAmount || parseFloat(inputAmount) <= 0) {
            document.getElementById('toAmount').value = '';
            document.getElementById('swapButton').textContent = 'Enter amount';
            document.getElementById('swapButton').disabled = true;
            return;
        }
        
        try {
            const fromToken = TOKENS[this.selectedFromToken];
            const toToken = TOKENS[this.selectedToToken];
            
            // Simple price calculation for demo
            const outputAmount = (parseFloat(inputAmount) * fromToken.price / toToken.price * 0.997).toFixed(6); // 0.3% fee
            document.getElementById('toAmount').value = outputAmount;
            
            // Update swap details
            const priceImpact = '0.12%';
            const minimumReceived = (parseFloat(outputAmount) * 0.995).toFixed(6); // 0.5% slippage tolerance
            
            document.getElementById('priceImpact').textContent = priceImpact;
            document.getElementById('minimumReceived').textContent = `${minimumReceived} ${toToken.symbol}`;
            
            // Enable swap button
            document.getElementById('swapButton').disabled = false;
            document.getElementById('swapButton').textContent = `Swap ${fromToken.symbol} for ${toToken.symbol}`;
            
        } catch (error) {
            console.error('Swap calculation failed:', error);
        }
    }
    
    async executeSwap() {
        if (!this.userAddress) {
            this.showNotification('Please connect your wallet first', 'warning');
            return;
        }
        
        const fromAmount = document.getElementById('fromAmount').value;
        if (!fromAmount || parseFloat(fromAmount) <= 0) {
            this.showNotification('Please enter a valid amount', 'warning');
            return;
        }
        
        try {
            this.showLoading('Executing swap...');
            
            // For demo purposes, just show success message
            // In real implementation, this would interact with pool contracts
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction time
            
            this.hideLoading();
            this.showNotification('Swap completed successfully!', 'success');
            
            // Clear form
            document.getElementById('fromAmount').value = '';
            document.getElementById('toAmount').value = '';
            
            // Update balances
            await this.updateTokenBalances();
            
        } catch (error) {
            this.hideLoading();
            this.showNotification('Swap failed: ' + error.message, 'error');
        }
    }
    
    calculateLiquidityB(amountA) {
        if (!amountA || parseFloat(amountA) <= 0) {
            document.getElementById('tokenBAmount').value = '';
            return;
        }
        
        // Simple 1:2 ratio for demo (TKA:TKB)
        const amountB = (parseFloat(amountA) * 2).toFixed(6);
        document.getElementById('tokenBAmount').value = amountB;
        
        this.updateLiquidityDetails(amountA, amountB);
    }
    
    calculateLiquidityA(amountB) {
        if (!amountB || parseFloat(amountB) <= 0) {
            document.getElementById('tokenAAmount').value = '';
            return;
        }
        
        // Simple 1:2 ratio for demo (TKA:TKB)
        const amountA = (parseFloat(amountB) / 2).toFixed(6);
        document.getElementById('tokenAAmount').value = amountA;
        
        this.updateLiquidityDetails(amountA, amountB);
    }
    
    updateLiquidityDetails(amountA, amountB) {
        if (!amountA || !amountB) return;
        
        const totalValue = parseFloat(amountA) * 1 + parseFloat(amountB) * 2; // USD value
        const poolShare = '0.5%'; // Mock calculation
        const elfTokens = (totalValue / 3).toFixed(2); // Mock ELF calculation
        
        document.getElementById('poolShare').textContent = poolShare;
        document.getElementById('elfTokens').textContent = elfTokens;
        
        // Enable add liquidity button
        if (this.userAddress) {
            document.getElementById('addLiquidityButton').disabled = false;
            document.getElementById('addLiquidityButton').textContent = 'Add Liquidity';
        }
    }
    
    async addLiquidity() {
        if (!this.userAddress) {
            this.showNotification('Please connect your wallet first', 'warning');
            return;
        }
        
        const amountA = document.getElementById('tokenAAmount').value;
        const amountB = document.getElementById('tokenBAmount').value;
        
        if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
            this.showNotification('Please enter valid amounts for both tokens', 'warning');
            return;
        }
        
        try {
            this.showLoading('Adding liquidity...');
            
            // For demo purposes, simulate transaction
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            this.hideLoading();
            this.showNotification('Liquidity added successfully!', 'success');
            
            // Clear form
            document.getElementById('tokenAAmount').value = '';
            document.getElementById('tokenBAmount').value = '';
            
            // Update balances and positions
            await this.updateTokenBalances();
            await this.updateUserPositions();
            
        } catch (error) {
            this.hideLoading();
            this.showNotification('Failed to add liquidity: ' + error.message, 'error');
        }
    }
    
    async createProposal() {
        if (!this.userAddress) {
            this.showNotification('Please connect your wallet first', 'warning');
            return;
        }
        
        const title = document.getElementById('proposalTitle').value;
        const description = document.getElementById('proposalDescription').value;
        
        if (!title || !description) {
            this.showNotification('Please enter both title and description', 'warning');
            return;
        }
        
        try {
            this.showLoading('Creating proposal...');
            
            // Simulate proposal creation
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.hideLoading();
            this.showNotification('Proposal created successfully!', 'success');
            
            // Clear form
            document.getElementById('proposalTitle').value = '';
            document.getElementById('proposalDescription').value = '';
            
        } catch (error) {
            this.hideLoading();
            this.showNotification('Failed to create proposal: ' + error.message, 'error');
        }
    }
    
    async vote(proposalCard, support) {
        if (!this.userAddress) {
            this.showNotification('Please connect your wallet first', 'warning');
            return;
        }
        
        try {
            this.showLoading('Submitting vote...');
            
            // Simulate voting
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.hideLoading();
            this.showNotification(`Vote ${support ? 'for' : 'against'} submitted successfully!`, 'success');
            
            // Disable voting buttons for this proposal
            const buttons = proposalCard.querySelectorAll('.btn-vote-for, .btn-vote-against');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.textContent = 'Voted';
            });
            
        } catch (error) {
            this.hideLoading();
            this.showNotification('Failed to submit vote: ' + error.message, 'error');
        }
    }
    
    async loadMockData() {
        // Load some mock data for the demo
        document.getElementById('totalTVL').textContent = '$5,234,567';
        document.getElementById('totalPools').textContent = '3';
        document.getElementById('currentMode').textContent = 'Pool Mode';
    }
    
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const messageEl = overlay.querySelector('p');
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 1001;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
        
        // Add CSS animations if not exists
        if (!document.getElementById('notificationStyles')) {
            const styles = document.createElement('style');
            styles.id = 'notificationStyles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
    
    getNotificationColor(type) {
        const colors = {
            success: 'linear-gradient(135deg, #10b981, #059669)',
            error: 'linear-gradient(135deg, #ef4444, #dc2626)',
            warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
            info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
        };
        return colors[type] || colors.info;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.easyDEXApp = new EasyDEXApp();
});