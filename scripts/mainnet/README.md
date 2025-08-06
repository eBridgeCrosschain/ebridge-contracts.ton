# Mainnet Scripts Documentation

This directory contains scripts for deploying and managing the eBridge contracts on the TON mainnet. These scripts provide functionality for deploying bridge components, initializing configurations, and managing liquidity operations.

## Scripts Overview

### 1. `mainnetDeployBridge.ts`
Deploys the main Bridge contract to mainnet.

**Purpose**: 
- Creates and deploys the core Bridge contract
- Sets up initial bridge configuration including oracle address and empty dictionaries
- Configures admin and owner permissions

**Configuration**:
- Oracle address: `EQA7xEMU7IVqNxmUPYqIgfh4BnzCeiWnQ3IP7TGu6lmmzCZ5`
- Initial settings: empty pool contracts, jetton whitelist, and receipt records
- Deployment cost: 10 TON

**Usage**:
```bash
npx blueprint run mainnetDeployBridge
```

### 2. `mainnetDeployBridgePool.ts`
Deploys a Bridge Pool contract for specific jetton (USDT).

**Purpose**:
- Creates and deploys a BridgePool contract for USDT token
- Links to the bridge address (needs to be configured)
- Sets up empty dictionaries for limits and swaps

**Configuration**:
- USDT address: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
- Bridge address: **Needs to be configured** (currently empty)
- Deployment cost: 0.05 TON

**Usage**:
```bash
npx blueprint run mainnetDeployBridgePool
```

⚠️ **Important**: Update the `bridgeAddress` variable with the actual deployed bridge address before running.

### 3. `mainnetInitContract.ts`
Comprehensive contract initialization and configuration script.

**Purpose**:
- Initializes bridge and bridge pool contracts with proper configurations
- Sets up jetton whitelist, target contracts, swap pairs, and limits
- Manages liquidity operations and contract relationships

**Key Operations** (most are commented out for safety):
- Add jetton whitelist for supported chains (aElf MainChain: 9992731, aElf SideChain: 1866392)
- Set bridge pool relationships
- Configure target contracts on other chains
- Create swap pairs with 1:1 ratios
- Set daily and rate limits for cross-chain operations
- Add/remove liquidity operations

**Chain IDs**:
- aElf SideChain: `1866392`
- aElf MainChain: `9992731`

**Target Contracts**:
- SideChain: `GZs6wyPDfz3vdEmgVd3FyrQfaWSXo9uRvc7Fbp5KSLKwMAANd`
- MainChain: `2dKF3svqDXrYtA5mYwKfADiHajo37mLZHPHVVuGbEDoD9jSgE8`

**Usage**:
```bash
npx blueprint run mainnetInitContract
```

⚠️ **Critical**: 
- Update `bridgeAddress` and `bridgePoolAddress` with actual deployed addresses
- Carefully uncomment and configure the operations you need
- Test each operation step by step

### 4. `mainnetAddLiquidity.ts`
Adds liquidity to the bridge pool.

**Purpose**:
- Provides USDT liquidity to the bridge pool
- Enables cross-chain bridging operations

**Configuration**:
- Default liquidity amount: 100,000,000 (100 USDT in smallest units)
- Transaction cost: 0.15 TON
- Forward amount: 0.1 TON

**Usage**:
```bash
npx blueprint run mainnetAddLiquidity
```

⚠️ **Prerequisites**: 
- Bridge and BridgePool must be deployed and initialized
- User must have sufficient USDT balance
- Update addresses before running

### 5. `mainnetUpdateContract.ts`
Updates existing bridge contracts with new code.

**Purpose**:
- Upgrades Bridge and BridgePool contract code
- Implements two-phase upgrade process (init + finalize)

**Configuration**:
- Bridge address: `EQBnIw0A17M18zeEHEekgpL32e6yu9cx57PnC990pByv2qJN`
- BridgePool address: `EQBfBX543e7-MXC9iYoq1td_DsMufSqbfHN5L-biMTJqwf-e`

**Upgrade Process**:
1. Initialize code upgrade for Bridge (0.01 TON)
2. Initialize code upgrade for BridgePool (0.1 TON)
3. Finalize Bridge upgrade (0.01 TON)
4. Finalize BridgePool upgrade (0.02 TON)

**Usage**:
```bash
npx blueprint run mainnetUpdateContract
```

## Deployment Sequence

For a complete mainnet deployment, follow this sequence:

1. **Deploy Bridge Contract**
   ```bash
   npx blueprint run mainnetDeployBridge
   ```

2. **Update Bridge Address**
   - Copy the deployed bridge address
   - Update `bridgeAddress` in other scripts

3. **Deploy Bridge Pool**
   ```bash
   npx blueprint run mainnetDeployBridgePool
   ```

4. **Update Pool Address**
   - Copy the deployed pool address
   - Update `bridgePoolAddress` in initialization script

5. **Initialize Contracts**
   ```bash
   npx blueprint run mainnetInitContract
   ```
   - Uncomment operations step by step
   - Verify each configuration before proceeding

6. **Add Initial Liquidity**
   ```bash
   npx blueprint run mainnetAddLiquidity
   ```

## Security Considerations

- 🔐 **Admin Keys**: Ensure proper key management for admin and owner addresses
- 🔍 **Address Verification**: Always verify contract addresses before operations
- 💰 **Gas Costs**: Monitor TON balance for deployment and operation costs
- 📋 **Staged Deployment**: Test operations on testnet first
- 🔄 **Upgrade Safety**: Use two-phase upgrade process for contract updates

## Common Issues and Solutions

### Address Configuration
- **Problem**: Empty or incorrect contract addresses
- **Solution**: Always update addresses after deployment

### Insufficient Balance
- **Problem**: Not enough TON for transactions
- **Solution**: Ensure sufficient TON balance (minimum 15 TON recommended)

### Jetton Balance
- **Problem**: Insufficient USDT for liquidity operations
- **Solution**: Verify USDT balance before adding liquidity

### Permission Errors
- **Problem**: Admin/owner permission denied
- **Solution**: Ensure correct sender address with proper permissions

## Support

For issues or questions regarding mainnet deployment:
1. Check testnet scripts first for reference
2. Verify all addresses and configurations
3. Test with small amounts initially
4. Contact development team for critical issues

---

**⚠️ Warning**: Mainnet operations involve real funds. Always double-check configurations and test thoroughly on testnet before mainnet deployment. 