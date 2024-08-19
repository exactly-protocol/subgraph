import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { RewardAmountNotified as RewardAmountNotifiedEvent } from '../generated/StakedEXA/StakedEXA';
import { RewardAmountNotified, StakingSharedFee } from '../generated/schema';
import toId from './utils/toId';

function loadStakingSharedFee(reward: Bytes): StakingSharedFee {
  const id = reward.toHexString();
  let sharedFee = StakingSharedFee.load(id);
  if (sharedFee) return sharedFee;

  sharedFee = new StakingSharedFee(id);
  sharedFee.reward = reward;
  sharedFee.amount = BigInt.zero();
  return sharedFee;
}

export default function handleRewardAmountNotified(event: RewardAmountNotifiedEvent): void {
  const rewardAmountNotified = new RewardAmountNotified(toId(event));
  const amount = event.params.amount;
  const notifier = event.params.notifier;
  const reward = event.params.reward;
  const timestamp = event.block.timestamp.toI32();
  rewardAmountNotified.amount = amount;
  rewardAmountNotified.reward = reward;
  rewardAmountNotified.notifier = notifier;
  rewardAmountNotified.timestamp = timestamp;
  rewardAmountNotified.save();

  if (event.address.equals(notifier)) {
    const stakingSharedFee = loadStakingSharedFee(reward);
    stakingSharedFee.amount = stakingSharedFee.amount.plus(amount);
    stakingSharedFee.lastUpdate = timestamp;
    stakingSharedFee.save();
  }
}
