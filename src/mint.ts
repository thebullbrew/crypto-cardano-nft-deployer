/**
 * Mints exactly one NFT under a fresh one-shot policy and attaches CIP-25
 * metadata (label 721).
 *
 * How the one-shot works: a pure-ADA UTxO from your wallet is chosen as the
 * "seed". Its (txHash, outputIndex) is baked into the Plutus script as a
 * parameter, producing a unique policy ID. The validator only succeeds when
 * that exact UTxO is consumed — and a UTxO can only be spent once — so this
 * policy ID can never mint again. Supply is provably 1.
 *
 * Prerequisites:
 *   1. Install Aiken: https://aiken-lang.org/installation-instructions
 *   2. Compile the policy: cd validators && aiken build && cp plutus.json ..
 *   3. Fund the deployer wallet (Preprod faucet: https://faucet.cardano.org)
 *      with at least ~10 ADA: fees + min-UTxO + Plutus collateral.
 *
 * Run: npm run mint
 * After minting, SAVE the printed SEED_TX_HASH / SEED_OUTPUT_INDEX —
 * burn.ts needs them to reconstruct the policy.
 */
import * as fs from "fs";
import { fromText, Lucid, toUnit } from "lucid-cardano";
import { loadConfig } from "./config";
import { buildOneShotPolicy, mintingRedeemer } from "./policy";

/** Fill the CIP-25 template with this mint's policy ID and asset name. */
function buildCip25Metadata(policyId: string, assetName: string): object {
  const raw = fs.readFileSync("assets/metadata-template.json", "utf8");
  const filled = raw
    .replace(/<policy_id>/g, policyId)
    .replace(/<asset_name>/g, assetName);
  return JSON.parse(filled)["721"];
}

async function main() {
  const config = loadConfig();
  const lucid = await Lucid.new(config.blockfrost, config.network);
  lucid.selectWalletFromSeed(config.seedPhrase);

  const ownAddress = await lucid.wallet.address();
  const recipient = config.mintRecipient || ownAddress;
  console.log(`Network: ${config.network} | Recipient: ${recipient}`);

  const utxos = await lucid.wallet.getUtxos();
  // Seed: a pure-ADA UTxO. It gets consumed by the mint — that's what makes
  // the policy one-shot. Keep another pure-ADA UTxO in the wallet for
  // Plutus collateral.
  const seedUtxo = utxos.find(
    (u) => Object.keys(u.assets).length === 1 && u.assets["lovelace"]
  );
  if (!seedUtxo) {
    throw new Error(
      "No pure-ADA UTxO available for the one-shot seed. Fund the wallet first."
    );
  }

  const { policy, policyId } = buildOneShotPolicy(
    lucid,
    { txHash: seedUtxo.txHash, outputIndex: seedUtxo.outputIndex },
    config.plutusScriptVersion
  );
  console.log(`Policy ID: ${policyId}`);

  const assetNameHex = fromText(config.assetName);
  const unit = toUnit(policyId, assetNameHex);

  const tx = await lucid
    .newTx()
    .collectFrom([seedUtxo])
    .mintAssets({ [unit]: 1n }, mintingRedeemer())
    .attachMintingPolicy(policy)
    .attachMetadata(721, buildCip25Metadata(policyId, config.assetName))
    .payToAddress(recipient, { [unit]: 1n })
    .complete();

  const signed = await tx.sign().complete();
  const txHash = await signed.submit();

  console.log(`\nMinted 1x ${unit} -> ${recipient}`);
  console.log(`Tx hash: ${txHash}`);
  console.log("\nSave these for burn.ts:");
  console.log(`  SEED_TX_HASH=${seedUtxo.txHash}`);
  console.log(`  SEED_OUTPUT_INDEX=${seedUtxo.outputIndex}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
