/**
 * CLI entrypoint for running a real Overpass discovery pass. Edit the
 * categories/bbox below (or extend this to read CLI args) for a real run.
 */
import { logger } from "@ai-website-maker/core";
import { runDiscovery } from "@ai-website-maker/discovery";

async function main() {
  // Small real area used for verification: Marlow, Buckinghamshire, UK.
  const results = await runDiscovery({
    categories: ["shop=bakery", "shop=hairdresser"],
    bbox: { south: 51.565, west: -0.785, north: 51.578, east: -0.758 },
  });

  logger.info({ results }, "Discovery run complete");
}

main().catch((err) => {
  logger.error(err, "Discovery run failed");
  process.exitCode = 1;
});
