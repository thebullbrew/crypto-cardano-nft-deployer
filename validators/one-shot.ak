// One-shot minting policy.
//
// Design:
// - Minting requires consuming a specific "seed" UTxO baked into the script
//   as a parameter. A UTxO can only be spent once, so this policy can only
//   ever authorize a single mint transaction: the supply is provably fixed.
// - Burning is always allowed (it can only reduce supply), which is what
//   makes corrections possible: burn the bad token, then re-mint the fixed
//   artwork under a FRESH policy (new seed UTxO).
//
// The redeemer selects the action:
//   Minting -> exactly 1 token minted, seed UTxO consumed.
//   Burning -> exactly 1 token burned, no seed required.
use aiken/collection/dict
use aiken/collection/list
use cardano/assets.{PolicyId, tokens}
use cardano/transaction.{OutputReference, Transaction}

pub type Action {
  Minting
  Burning
}

validator one_shot(seed: OutputReference) {
  mint(redeemer: Action, policy_id: PolicyId, tx: Transaction) {
    // Exactly one asset type may be minted or burned per transaction.
    expect [Pair(_asset_name, quantity)] =
      tx.mint |> tokens(policy_id) |> dict.to_pairs()

    let seed_consumed =
      list.any(tx.inputs, fn(input) { input.output_reference == seed })

    when redeemer is {
      Minting -> seed_consumed? && (quantity == 1)?
      Burning -> (quantity == -1)?
    }
  }
}
