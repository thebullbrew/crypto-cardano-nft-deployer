import * as fs from "fs";
import * as path from "path";
import {
  applyParamsToScript,
  Constr,
  Data,
  Lucid,
  MintingPolicy,
  PolicyId,
} from "lucid-cardano";

/** Minimal reference to a UTxO — enough to parameterize the policy. */
export interface SeedRef {
  txHash: string;
  outputIndex: number;
}

interface BlueprintValidator {
  title: string;
  compiledCode: string;
}

/**
 * Load the compiled one-shot validator from the Aiken blueprint.
 * Generate it with:  cd validators && aiken build && cp plutus.json ..
 */
export function loadCompiledScript(blueprintPath = "plutus.json"): string {
  const full = path.resolve(blueprintPath);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Aiken blueprint not found at ${full}.\n` +
        "Compile the policy first:\n" +
        "  cd validators && aiken build && cp plutus.json .."
    );
  }
  const blueprint = JSON.parse(fs.readFileSync(full, "utf8"));
  const validator = (blueprint.validators as BlueprintValidator[]).find(
    (v) => v.title === "one_shot.one_shot"
  );
  if (!validator) {
    throw new Error(`Validator "one_shot.one_shot" not found in ${full}.`);
  }
  return validator.compiledCode;
}

/**
 * Build the one-shot minting policy for a seed UTxO.
 *
 * Applying the (txHash, outputIndex) parameter bakes the seed into the
 * script, yielding a unique policy ID. The on-chain validator only succeeds
 * when that exact UTxO is consumed — and a UTxO can only be spent once —
 * so the policy can never mint twice.
 */
export function buildOneShotPolicy(
  lucid: Lucid,
  seed: SeedRef,
  scriptVersion: "PlutusV1" | "PlutusV2" = "PlutusV2"
): { policy: MintingPolicy; policyId: PolicyId } {
  const compiledCode = loadCompiledScript();
  // Aiken's OutputReference = Constr(0, [txHash bytes, outputIndex]).
  // (In Lucid's Data encoding, a string inside a Constr is hex bytes.)
  const seedParam = new Constr(0, [seed.txHash, BigInt(seed.outputIndex)]);
  const policy: MintingPolicy = {
    type: scriptVersion,
    script: applyParamsToScript(compiledCode, [seedParam]),
  };
  return { policy, policyId: lucid.utils.mintingPolicyToId(policy) };
}

/** Redeemer selecting the validator's Minting branch (Action::Minting). */
export function mintingRedeemer(): string {
  return Data.to(new Constr(0, []));
}

/** Redeemer selecting the validator's Burning branch (Action::Burning). */
export function burningRedeemer(): string {
  return Data.to(new Constr(1, []));
}
