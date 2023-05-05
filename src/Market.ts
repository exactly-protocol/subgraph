import { Address, BigInt } from '@graphprotocol/graph-ts';
import { InterestRateModel } from '../generated/MarketWETH/InterestRateModel';
import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
  Borrow as BorrowEvent,
  Repay as RepayEvent,
  Transfer as TransferEvent,

  DepositAtMaturity as DepositAtMaturityEvent,
  WithdrawAtMaturity as WithdrawAtMaturityEvent,
  BorrowAtMaturity as BorrowAtMaturityEvent,
  RepayAtMaturity as RepayAtMaturityEvent,

  Liquidate as LiquidateEvent,
  Seize as SeizeEvent,

  EarningsAccumulatorSmoothFactorSet as EarningsAccumulatorSmoothFactorSetEvent,
  InterestRateModelSet as InterestRateModelSetEvent,
  TreasurySet as TreasurySetEvent,

  MarketUpdate as MarketUpdateEvent,
  FixedEarningsUpdate as FixedEarningsUpdateEvent,
  AccumulatorAccrual as AccumulatorAccrualEvent,
  FloatingDebtUpdate as FloatingDebtUpdateEvent,

  MaxFuturePoolsSet as MaxFuturePoolsSetEvent,
  PenaltyRateSet as PenaltyRateSetEvent,
  ReserveFactorSet as ReserveFactorSetEvent,
  BackupFeeRateSet as BackupFeeRateSetEvent,
  Market,
} from '../generated/MarketWETH/Market';

import {
  Deposit, Withdraw, Borrow, Repay, Transfer,
  DepositAtMaturity, WithdrawAtMaturity, BorrowAtMaturity, RepayAtMaturity,
  Liquidate, Seize,
  EarningsAccumulatorSmoothFactorSet, InterestRateModelSet, TreasurySet,
  MarketUpdate, FixedEarningsUpdate, AccumulatorAccrual, FloatingDebtUpdate,
  MaxFuturePoolsSet, PenaltyRateSet, ReserveFactorSet, BackupFeeRateSet,
} from '../generated/schema';
import fixedRate from './utils/fixedRate';
import loadAccount from './utils/loadAccount';
import loadFixedPool from './utils/loadFixedPool';
import loadFixedPosition from './utils/loadFixedPosition';
import loadMarket from './utils/loadMarket';
import toId from './utils/toId';
import { updateMarketState } from './utils/updateMarketState';

export function handleDeposit(event: DepositEvent): void {
  const entity = new Deposit(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.caller = event.params.caller;
  entity.owner = event.params.owner;
  entity.assets = event.params.assets;
  entity.shares = event.params.shares;
  entity.save();
}

export function handleWithdraw(event: WithdrawEvent): void {
  const entity = new Withdraw(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.caller = event.params.caller;
  entity.receiver = event.params.receiver;
  entity.owner = event.params.owner;
  entity.assets = event.params.assets;
  entity.shares = event.params.shares;
  entity.save();
}

export function handleBorrow(event: BorrowEvent): void {
  const entity = new Borrow(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.caller = event.params.caller;
  entity.receiver = event.params.receiver;
  entity.borrower = event.params.borrower;
  entity.assets = event.params.assets;
  entity.shares = event.params.shares;
  entity.save();

  const account = loadAccount(entity.borrower, entity.market);
  account.borrowShares = account.borrowShares.plus(entity.shares);
  account.save();

  const market = loadMarket(entity.market);
  market.totalFloatingBorrowShares = market.totalFloatingBorrowShares.plus(
    entity.shares,
  );
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.save();

  updateMarketState(event, market);
}

export function handleRepay(event: RepayEvent): void {
  const entity = new Repay(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.caller = event.params.caller;
  entity.borrower = event.params.borrower;
  entity.assets = event.params.assets;
  entity.shares = event.params.shares;
  entity.save();

  const account = loadAccount(entity.borrower, entity.market);
  account.borrowShares = account.borrowShares.minus(entity.shares);
  account.save();

  const market = loadMarket(entity.market);
  market.totalFloatingBorrowShares = market.totalFloatingBorrowShares.minus(
    entity.shares,
  );
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.save();

  updateMarketState(event, market);
}

export function handleTransfer(event: TransferEvent): void {
  const entity = new Transfer(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.shares = event.params.amount;
  entity.save();
  const market = loadMarket(entity.market);

  if (entity.from.equals(Address.zero())) {
    market.totalSupply = market.totalSupply.plus(entity.shares);
  } else {
    const accountFrom = loadAccount(entity.from, entity.market);
    accountFrom.depositShares = accountFrom.depositShares.minus(entity.shares);
    accountFrom.save();
  }

  if (entity.to.equals(Address.zero())) {
    market.totalSupply = market.totalSupply.minus(entity.shares);
  } else {
    const accountTo = loadAccount(entity.to, entity.market);
    accountTo.depositShares = accountTo.depositShares.plus(entity.shares);
    accountTo.save();
  }
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.save();

  updateMarketState(event, market);
}

export function handleDepositAtMaturity(event: DepositAtMaturityEvent): void {
  const entity = new DepositAtMaturity(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.maturity = event.params.maturity.toU32();
  entity.caller = event.params.caller;
  entity.owner = event.params.owner;
  entity.assets = event.params.assets;
  entity.fee = event.params.fee;
  entity.save();

  const position = loadFixedPosition(loadAccount(entity.owner, entity.market), entity.maturity);
  const totalAmount = position.principal.plus(entity.assets);
  position.rate = (position.principal.times(position.rate).plus(entity.assets
    .times(fixedRate(entity.assets, entity.fee, entity.timestamp, entity.maturity)))
  ).div(totalAmount);
  position.principal = totalAmount;
  position.fee = position.fee.plus(entity.fee);
  position.save();
}

export function handleWithdrawAtMaturity(event: WithdrawAtMaturityEvent): void {
  const entity = new WithdrawAtMaturity(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.maturity = event.params.maturity.toU32();
  entity.caller = event.params.caller;
  entity.receiver = event.params.receiver;
  entity.owner = event.params.owner;
  entity.positionAssets = event.params.positionAssets;
  entity.assets = event.params.assets;
  entity.save();

  const position = loadFixedPosition(loadAccount(entity.owner, entity.market), entity.maturity);
  const principal = entity.positionAssets.times(position.principal)
    .div(position.principal.plus(position.fee));
  const fee = entity.positionAssets.minus(principal);
  position.principal = position.principal.minus(principal);
  position.fee = position.fee.minus(fee);

  if (position.principal.equals(BigInt.zero())) position.rate = BigInt.zero();
  position.save();
}

export function handleBorrowAtMaturity(event: BorrowAtMaturityEvent): void {
  const entity = new BorrowAtMaturity(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.maturity = event.params.maturity.toU32();
  entity.caller = event.params.caller;
  entity.receiver = event.params.receiver;
  entity.borrower = event.params.borrower;
  entity.assets = event.params.assets;
  entity.fee = event.params.fee;
  entity.save();

  const position = loadFixedPosition(
    loadAccount(entity.borrower, entity.market),
    entity.maturity,
    true,
  );
  const totalAmount = position.principal.plus(entity.assets);
  position.rate = (position.principal.times(position.rate).plus(entity.assets
    .times(fixedRate(entity.assets, entity.fee, entity.timestamp, entity.maturity)))
  ).div(totalAmount);
  position.fee = position.fee.plus(entity.fee);
  position.principal = totalAmount;
  position.save();
}

export function handleRepayAtMaturity(event: RepayAtMaturityEvent): void {
  const entity = new RepayAtMaturity(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.maturity = event.params.maturity.toU32();
  entity.caller = event.params.caller;
  entity.borrower = event.params.borrower;
  entity.assets = event.params.assets;
  entity.debtCovered = event.params.positionAssets;
  entity.save();

  const position = loadFixedPosition(
    loadAccount(entity.borrower, entity.market),
    entity.maturity,
    true,
  );
  const principal = entity.debtCovered.times(position.principal)
    .div(position.principal.plus(position.fee));
  const fee = entity.debtCovered.minus(principal);
  position.principal = position.principal.minus(principal);
  position.fee = position.fee.minus(fee);

  if (position.principal.equals(BigInt.zero())) position.rate = BigInt.zero();
  position.save();
}

export function handleLiquidate(event: LiquidateEvent): void {
  const entity = new Liquidate(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.receiver = event.params.receiver;
  entity.borrower = event.params.borrower;
  entity.assets = event.params.assets;
  entity.collateralMarket = event.params.seizeMarket;
  entity.seizedAssets = event.params.seizedAssets;
  entity.save();
}

export function handleSeize(event: SeizeEvent): void {
  const entity = new Seize(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.liquidator = event.params.liquidator;
  entity.borrower = event.params.borrower;
  entity.assets = event.params.assets;
  entity.save();
}

export function handleEarningsAccumulatorSmoothFactorSet(
  event: EarningsAccumulatorSmoothFactorSetEvent,
): void {
  const entity = new EarningsAccumulatorSmoothFactorSet(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.earningsAccumulatorSmoothFactor = event.params.earningsAccumulatorSmoothFactor;
  entity.save();

  const market = loadMarket(entity.market);
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.earningsAccumulatorSmoothFactor = entity.earningsAccumulatorSmoothFactor;
  market.save();

  updateMarketState(event, market);
}

export function handleInterestRateModelSet(event: InterestRateModelSetEvent): void {
  const entity = new InterestRateModelSet(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.interestRateModel = event.params.interestRateModel;

  const irm = InterestRateModel.bind(event.params.interestRateModel);
  entity.fixedCurveA = irm.fixedCurveA();
  entity.fixedCurveB = irm.fixedCurveB();
  entity.fixedMaxUtilization = irm.fixedMaxUtilization();
  entity.floatingCurveA = irm.floatingCurveA();
  entity.floatingCurveB = irm.floatingCurveB();
  entity.floatingMaxUtilization = irm.floatingMaxUtilization();

  entity.save();

  const market = loadMarket(entity.market);
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();

  market.interestRateModel = entity.interestRateModel;
  market.fixedCurveA = entity.fixedCurveA;
  market.fixedCurveB = entity.fixedCurveB;
  market.fixedMaxUtilization = entity.fixedMaxUtilization;
  market.floatingCurveA = entity.floatingCurveA;
  market.floatingCurveB = entity.floatingCurveB;
  market.floatingMaxUtilization = entity.floatingMaxUtilization;
  market.save();

  updateMarketState(event, market);
}

export function handleTreasurySet(event: TreasurySetEvent): void {
  const entity = new TreasurySet(toId(event));
  entity.market = event.address;
  entity.timestamp = event.block.timestamp.toU32();
  entity.treasury = event.params.treasury;
  entity.treasuryFeeRate = event.params.treasuryFeeRate;
  entity.save();

  const market = loadMarket(entity.market);
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.treasury = entity.treasury;
  market.treasuryFeeRate = entity.treasuryFeeRate;
  market.save();

  updateMarketState(event, market);
}

export function handleMarketUpdate(event: MarketUpdateEvent): void {
  const entity = new MarketUpdate(toId(event));
  entity.market = event.address;
  entity.timestamp = event.params.timestamp.toU32();
  entity.floatingDepositShares = event.params.floatingDepositShares;
  entity.floatingAssets = event.params.floatingAssets;
  entity.floatingBorrowShares = event.params.floatingBorrowShares;
  entity.floatingDebt = event.params.floatingDebt;
  entity.earningsAccumulator = event.params.earningsAccumulator;
  entity.save();

  const market = loadMarket(entity.market);
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.lastMarketUpdate = entity.timestamp;
  market.floatingDepositShares = entity.floatingDepositShares;
  market.floatingAssets = entity.floatingAssets;
  market.floatingBorrowShares = entity.floatingBorrowShares;
  market.floatingDebt = entity.floatingDebt;
  market.earningsAccumulator = entity.earningsAccumulator;
  market.symbol = Market.bind(Address.fromBytes(entity.market)).symbol();
  market.save();

  updateMarketState(event, market);
}

export function handleFixedEarningsUpdate(event: FixedEarningsUpdateEvent): void {
  const entity = new FixedEarningsUpdate(toId(event));
  entity.market = event.address;
  entity.timestamp = event.params.timestamp.toU32();
  entity.maturity = event.params.maturity.toU32();
  entity.unassignedEarnings = event.params.unassignedEarnings;
  entity.save();

  const fixedPool = loadFixedPool(loadMarket(entity.market), entity.maturity);
  fixedPool.timestamp = entity.timestamp;
  fixedPool.unassignedEarnings = entity.unassignedEarnings;
  fixedPool.save();
}

export function handleAccumulatorAccrual(event: AccumulatorAccrualEvent): void {
  const entity = new AccumulatorAccrual(toId(event));
  entity.market = event.address;
  entity.timestamp = event.params.timestamp.toU32();
  entity.save();

  const market = loadMarket(entity.market);
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.lastAccumulatorAccrual = entity.timestamp;
  market.save();
  updateMarketState(event, market);
}

export function handleFloatingDebtUpdate(event: FloatingDebtUpdateEvent): void {
  const entity = new FloatingDebtUpdate(toId(event));
  entity.market = event.address;
  entity.timestamp = event.params.timestamp.toU32();
  entity.utilization = event.params.utilization;
  entity.save();

  const market = loadMarket(entity.market);
  market.timestamp = entity.timestamp;
  market.block = event.block.number.toU32();
  market.floatingUtilization = entity.utilization;
  market.lastFloatingDebtUpdate = entity.timestamp;
  market.save();
  updateMarketState(event, market);
}

export function handleMaxFuturePoolsSet(event: MaxFuturePoolsSetEvent): void {
  const entity = new MaxFuturePoolsSet(toId(event));
  entity.market = event.address;
  entity.block = event.block.number.toU32();
  entity.maxFuturePools = event.params.maxFuturePools.toI32();
  entity.timestamp = event.block.timestamp.toU32();
  entity.save();

  const market = loadMarket(entity.market);
  market.maxFuturePools = entity.maxFuturePools;
  market.block = event.block.number.toU32();
  market.timestamp = entity.timestamp;
  market.save();
  updateMarketState(event, market);
}

export function handlePenaltyRateSet(event: PenaltyRateSetEvent): void {
  const entity = new PenaltyRateSet(toId(event));
  entity.market = event.address;
  entity.block = event.block.number.toU32();
  entity.penaltyRate = event.params.penaltyRate;
  entity.timestamp = event.block.timestamp.toU32();
  entity.save();

  const market = loadMarket(entity.market);
  market.penaltyRate = entity.penaltyRate;
  market.block = event.block.number.toU32();
  market.timestamp = entity.timestamp;
  market.save();
  updateMarketState(event, market);
}

export function handleReserveFactorSet(event: ReserveFactorSetEvent): void {
  const entity = new ReserveFactorSet(toId(event));
  entity.market = event.address;
  entity.block = event.block.number.toU32();
  entity.reserveFactor = event.params.reserveFactor;
  entity.timestamp = event.block.timestamp.toU32();
  entity.save();

  const market = loadMarket(entity.market);
  market.reserveFactor = entity.reserveFactor;
  market.block = event.block.number.toU32();
  market.timestamp = entity.timestamp;
  market.save();
  updateMarketState(event, market);
}

export function handleBackupFeeRateSet(event: BackupFeeRateSetEvent): void {
  const entity = new BackupFeeRateSet(toId(event));
  entity.market = event.address;
  entity.block = event.block.number.toU32();
  entity.backupFeeRate = event.params.backupFeeRate;
  entity.timestamp = event.block.timestamp.toU32();
  entity.save();

  const market = loadMarket(entity.market);
  market.backupFeeRate = entity.backupFeeRate;
  market.block = event.block.number.toU32();
  market.timestamp = entity.timestamp;
  market.save();
  updateMarketState(event, market);
}
