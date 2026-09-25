/**
 * Burns the NFT minted by `npm run mint`.
 *
 * Why this works: the one-shot validator has two branches. Minting requires
 * the (already spent) seed UTxO, so no more tokens can ever be created under
 * this policy — but the Burning branch only checks that exactly one token is
 * destroyed, so corrections are always possible.
 *
 * Correction workflow: burn the bad token with this script, then run
 * `npm run mint` again — it derives a FRESH policy (new seed UTxO), so the
 * corrected NFT gets its own provably-scarce policy ID.
 *
 * Requires in .env:
 *   SEED_TX_HASH / SEED_OUTPUT_INDEX (printed by `npm run mint`),
 *   ASSET_NAME (same as the mint).
 * The deployer wallet must currently hold the NFT.
 *
 * Run: npm run burn
 */
import { fromText, Lucid, toUnit } from "lucid-cardano";
import { loadConfig } from "./config";
import { buildOneShotPolicy, burningRedeemer } from "./policy";

async function main() {
  const config = loadConfig();
  if (config.seedTxHash === undefined || config.seedOutputIndex === undefined) {
    throw new Error(
      "Set SEED_TX_HASH and SEED_OUTPUT_INDEX in .env (printed by npm run mint)."
    );
  }
  const lucid = await Lucid.new(config.blockfrost, config.network);
  lucid.selectWalletFromSeed(config.seedPhrase);

  // Reconstruct the exact policy the NFT was minted under.
  const { policy, policyId } = buildOneShotPolicy(
    lucid,
    { txHash: config.seedTxHash, outputIndex: config.seedOutputIndex },
    config.plutusScriptVersion
  );
  const unit = toUnit(policyId, fromText(config.assetName));
  console.log(`Policy ID: ${policyId}`);

  const utxos = await lucid.wallet.getUtxos();
  const nftUtxo = utxos.find((u) => (u.assets[unit] ?? 0n) > 0n);
  if (!nftUtxo) {
    throw new Error(`Deployer wallet does not hold ${unit}. Nothing to burn.`);
  }

  const tx = await lucid
    .newTx()
    .collectFrom([nftUtxo])
    .mintAssets({ [unit]: -1n }, burningRedeemer())
    .attachMintingPolicy(policy)
    .complete();

  const signed = await tx.sign().complete();
  const txHash = await signed.submit();

  console.log(`\nBurned 1x ${unit}`);
  console.log(`Tx hash: ${txHash}`);
  console.log(
    "To re-mint the corrected token, run `npm run mint` (fresh one-shot policy)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
