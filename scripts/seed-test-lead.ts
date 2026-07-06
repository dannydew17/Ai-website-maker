/**
 * Manual dev helper: inserts a couple of fake Lead rows so later pipeline
 * stages (qualification, harvesting, generation...) can be exercised without
 * first running a real Overpass discovery query.
 */
import { prisma, logger } from "@ai-website-maker/core";

async function main() {
  const noWebsiteLead = await prisma.lead.upsert({
    where: { osmId: "node/seed-no-website" },
    update: {},
    create: {
      osmId: "node/seed-no-website",
      osmType: "node",
      name: "Riverside Bakery",
      category: "shop=bakery",
      addressLine: "12 Riverside Lane",
      city: "Millbrook",
      postcode: "00000",
      latitude: 51.5,
      longitude: -0.1,
      phone: "+1-555-0100",
      openingHours: "Mo-Sa 07:00-18:00",
      existingWebsite: null,
      hasWebsite: false,
    },
  });

  const withWebsiteLead = await prisma.lead.upsert({
    where: { osmId: "node/seed-has-website" },
    update: {},
    create: {
      osmId: "node/seed-has-website",
      osmType: "node",
      name: "Millbrook Hair Studio",
      category: "shop=hairdresser",
      addressLine: "45 High Street",
      city: "Millbrook",
      postcode: "00000",
      latitude: 51.501,
      longitude: -0.099,
      phone: "+1-555-0101",
      openingHours: "Tu-Sa 09:00-17:00",
      existingWebsite: "https://example.com",
      hasWebsite: true,
    },
  });

  logger.info({ noWebsiteLead, withWebsiteLead }, "Seeded test leads");
}

main()
  .catch((err) => {
    logger.error(err, "Seed script failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
