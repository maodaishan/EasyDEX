#!/bin/bash

# EasyDEX Demo Launcher
# This script starts all required services for the EasyDEX demo

echo "🚀 EasyDEX Demo Launcher"
echo "========================"

# Check if Hardhat node is running
if ! curl -s http://127.0.0.1:8545 > /dev/null; then
    echo "⚠️  Hardhat node not running on port 8545"
    echo "Starting Hardhat node..."
    cd /home/alex/.openclaw/workspaces/earner/EasyDEX
    npx hardhat node --port 8545 &
    echo "Waiting for blockchain to start..."
    sleep 5
else
    echo "✅ Hardhat node is running"
fi

# Deploy contracts if not already deployed
echo "📝 Checking contract deployment..."
cd /home/alex/.openclaw/workspaces/earner/EasyDEX
if [ ! -f "deployments/localhost.json" ]; then
    echo "Deploying contracts..."
    npx hardhat run scripts/deploy-simple.js --network localhost
    echo "✅ Contracts deployed"
else
    echo "✅ Contracts already deployed"
fi

# Start frontend server
echo "🌐 Starting frontend server..."
cd frontend
pkill -f "python.*http.server" > /dev/null 2>&1
python3 -m http.server 3004 > /dev/null 2>&1 &
sleep 2

if curl -s http://localhost:3004 > /dev/null; then
    echo "✅ Frontend server running at http://localhost:3004"
else
    echo "❌ Failed to start frontend server"
    exit 1
fi

echo ""
echo "🎉 EasyDEX Demo is ready!"
echo "========================"
echo ""
echo "📱 Frontend URL: http://localhost:3004"
echo "⛓️  Blockchain RPC: http://127.0.0.1:8545"
echo "🔗 Chain ID: 31337 (Hardhat Local)"
echo ""
echo "🎯 Demo Instructions:"
echo "1. Open http://localhost:3004 in your browser"
echo "2. Install MetaMask if not already installed"
echo "3. Click 'Connect Wallet' and approve connection"
echo "4. Add Hardhat Local network to MetaMask:"
echo "   - Network Name: Hardhat Local"
echo "   - RPC URL: http://127.0.0.1:8545" 
echo "   - Chain ID: 31337"
echo "   - Currency: ETH"
echo "5. Import a test account from Hardhat:"
echo "   - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo "6. Try the swap, liquidity, governance, and analytics features!"
echo ""
echo "💡 Key Features to Demonstrate:"
echo "- ✨ Adaptive slippage algorithm switching"
echo "- 🔄 Token swapping with price impact calculation"
echo "- 💧 Liquidity provision with ELF/EASY rewards"
echo "- 🏛️ Governance voting with EASY tokens"
echo "- 📊 Analytics dashboard with protocol metrics"
echo ""
echo "📹 Perfect for recording a compelling demo video!"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap 'echo ""; echo "🛑 Stopping EasyDEX demo..."; pkill -f "hardhat node"; pkill -f "python.*http.server"; echo "✅ Demo stopped"; exit 0' INT

# Keep script running
while true; do
    sleep 1
done