import "dotenv/config";
import { Blockfrost } from "lucid-cardano";

export type CardanoNetwork = "Mainnet" | "Preprod";
export type PlutusScriptVersion = "PlutusV1" | "PlutusV2";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface CardanoConfig {
  network: CardanoNetwork;
  blockfrost: Blockfrost;
  /** BIP-39 seed phrase of the deployer wallet. DEDICATED wallet — never your main one. */
  seedPhrase: string;
  /** On-chain asset name (plain text, max 32 bytes). Hex-encoded for the unit. */
  assetName: string;
  /** Display name used in the CIP-25 metadata. */
  tokenDisplayName: string;
  description: string;
  /** Artwork URI — prefer ipfs://... so the art can't be rug-pulled. */
  imageUri: string;
  /** Defaults to the deployer address when empty. */
  mintRecipient?: string;
  /** Must match the Plutus version Aiken compiled (see plutus.json). */
  plutusScriptVersion: PlutusScriptVersion;
  /** Seed UTxO of the mint transaction — printed by `npm run mint`, needed by `npm run burn`. */
  seedTxHash?: string;
  seedOutputIndex?: number;
}

export function loadConfig(): CardanoConfig {
  const network = (process.env.CARDANO_NETWORK as CardanoNetwork) || "Preprod";
  if (network !== "Mainnet" && network !== "Preprod") {
    throw new Error(`CARDANO_NETWORK must be "Mainnet" or "Preprod", got "${network}".`);
  }

  const assetName = process.env.ASSET_NAME ?? "MyNFT1";
  if (new TextEncoder().encode(assetName).length > 32) {
    throw new Error("ASSET_NAME must be at most 32 bytes.");
  }

  const defaultRpc =
    network === "Mainnet"
      ? "https://cardano-mainnet.blockfrost.io/api/v0"
      : "https://cardano-preprod.blockfrost.io/api/v0";

  return {
    network,
    blockfrost: new Blockfrost(
      process.env.BLOCKFROST_URL || defaultRpc,
      required("BLOCKFROST_PROJECT_ID")
    ),
    seedPhrase: required("WALLET_SEED_PHRASE"),
    assetName,
    tokenDisplayName: process.env.TOKEN_DISPLAY_NAME ?? "My NFT #1",
    description:
      process.env.TOKEN_DESCRIPTION ?? "A professional NFT minted on Cardano.",
    imageUri: process.env.IMAGE_URI ?? "ipfs://QmYourImageHashHere/1.png",
    mintRecipient: process.env.MINT_RECIPIENT || undefined,
    plutusScriptVersion:
      (process.env.PLUTUS_SCRIPT_VERSION as PlutusScriptVersion) || "PlutusV2",
    seedTxHash: process.env.SEED_TX_HASH || undefined,
    seedOutputIndex:
      process.env.SEED_OUTPUT_INDEX !== undefined
        ? Number(process.env.SEED_OUTPUT_INDEX)
        : undefined,
  };
}
