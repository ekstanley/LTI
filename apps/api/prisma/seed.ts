/**
 * LTIP Database Seed Script
 *
 * Populates the database with sample data for development.
 * Run with: pnpm db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Congress
  const congress118 = await prisma.congress.upsert({
    where: { number: 118 },
    update: {},
    create: {
      number: 118,
      startDate: new Date('2023-01-03'),
      endDate: new Date('2025-01-03'),
      houseMajority: 'R',
      senateMajority: 'D',
    },
  });
  console.log(`Created Congress: ${congress118.number}`);

  // Create sample legislators
  const legislators = await Promise.all([
    prisma.legislator.upsert({
      where: { id: 'P000197' },
      update: {},
      create: {
        id: 'P000197',
        firstName: 'Nancy',
        lastName: 'Pelosi',
        fullName: 'Nancy Pelosi',
        party: 'D',
        chamber: 'HOUSE',
        state: 'CA',
        district: 11,
        isVotingMember: true,
        inOffice: true,
        leadershipRole: 'Speaker Emerita',
        website: 'https://pelosi.house.gov',
        twitterHandle: 'SpeakerPelosi',
        dataSource: 'CONGRESS_GOV',
      },
    }),
    prisma.legislator.upsert({
      where: { id: 'M000355' },
      update: {},
      create: {
        id: 'M000355',
        firstName: 'Mitch',
        lastName: 'McConnell',
        fullName: 'Addison Mitchell McConnell III',
        nickName: 'Mitch',
        party: 'R',
        chamber: 'SENATE',
        state: 'KY',
        isVotingMember: true,
        inOffice: true,
        leadershipRole: 'Minority Leader',
        website: 'https://mcconnell.senate.gov',
        twitterHandle: 'LeaderMcConnell',
        dataSource: 'CONGRESS_GOV',
      },
    }),
    prisma.legislator.upsert({
      where: { id: 'S000033' },
      update: {},
      create: {
        id: 'S000033',
        firstName: 'Bernard',
        lastName: 'Sanders',
        fullName: 'Bernard Sanders',
        nickName: 'Bernie',
        party: 'I',
        chamber: 'SENATE',
        state: 'VT',
        isVotingMember: true,
        inOffice: true,
        website: 'https://sanders.senate.gov',
        twitterHandle: 'SenSanders',
        dataSource: 'CONGRESS_GOV',
      },
    }),
    prisma.legislator.upsert({
      where: { id: 'A000360' },
      update: {},
      create: {
        id: 'A000360',
        firstName: 'Lamar',
        lastName: 'Alexander',
        fullName: 'Lamar Alexander',
        party: 'R',
        chamber: 'SENATE',
        state: 'TN',
        isVotingMember: true,
        inOffice: false,
        endReason: 'TERM_ENDED',
        termEnd: new Date('2021-01-03'),
        dataSource: 'CONGRESS_GOV',
      },
    }),
    prisma.legislator.upsert({
      where: { id: 'O000172' },
      update: {},
      create: {
        id: 'O000172',
        firstName: 'Alexandria',
        lastName: 'Ocasio-Cortez',
        fullName: 'Alexandria Ocasio-Cortez',
        nickName: 'AOC',
        party: 'D',
        chamber: 'HOUSE',
        state: 'NY',
        district: 14,
        isVotingMember: true,
        inOffice: true,
        website: 'https://ocasio-cortez.house.gov',
        twitterHandle: 'AOC',
        dataSource: 'CONGRESS_GOV',
      },
    }),
  ]);
  console.log(`Created ${legislators.length} legislators`);

  // Create policy areas
  const policyAreas = await Promise.all([
    prisma.policyArea.upsert({
      where: { name: 'Health' },
      update: {},
      create: { name: 'Health' },
    }),
    prisma.policyArea.upsert({
      where: { name: 'Taxation' },
      update: {},
      create: { name: 'Taxation' },
    }),
    prisma.policyArea.upsert({
      where: { name: 'Environmental Protection' },
      update: {},
      create: { name: 'Environmental Protection' },
    }),
    prisma.policyArea.upsert({
      where: { name: 'Armed Forces and National Security' },
      update: {},
      create: { name: 'Armed Forces and National Security' },
    }),
    prisma.policyArea.upsert({
      where: { name: 'Economics and Public Finance' },
      update: {},
      create: { name: 'Economics and Public Finance' },
    }),
  ]);
  console.log(`Created ${policyAreas.length} policy areas`);

  // Create sample bills
  const bills = await Promise.all([
    prisma.bill.upsert({
      where: { id: 'hr-1-118' },
      update: {},
      create: {
        id: 'hr-1-118',
        congressNumber: 118,
        billType: 'HR',
        billNumber: 1,
        title:
          'Lower Energy Costs Act - To provide for the development of domestic petroleum, natural gas, and critical minerals resources',
        shortTitle: 'Lower Energy Costs Act',
        summary:
          'This bill addresses the domestic production and use of energy. The bill requires the Department of the Interior to conduct oil and gas lease sales and issue permits for energy projects on federal lands.',
        status: 'PASSED_HOUSE',
        introducedDate: new Date('2023-01-09'),
        lastActionDate: new Date('2023-03-30'),
        dataSource: 'CONGRESS_GOV',
        dataQuality: 'VERIFIED',
        policyAreaId: policyAreas[2].id, // Environmental Protection
      },
    }),
    prisma.bill.upsert({
      where: { id: 's-1-118' },
      update: {},
      create: {
        id: 's-1-118',
        congressNumber: 118,
        billType: 'S',
        billNumber: 1,
        title: 'A bill to prohibit the use of TikTok on devices of the United States Government',
        shortTitle: 'No TikTok on Government Devices Act',
        summary:
          'This bill prohibits downloading or using TikTok or any successor application developed by ByteDance on federal government devices.',
        status: 'SIGNED_INTO_LAW',
        introducedDate: new Date('2023-01-03'),
        lastActionDate: new Date('2023-12-22'),
        dataSource: 'CONGRESS_GOV',
        dataQuality: 'VERIFIED',
        policyAreaId: policyAreas[3].id, // Armed Forces and National Security
      },
    }),
    prisma.bill.upsert({
      where: { id: 'hr-25-118' },
      update: {},
      create: {
        id: 'hr-25-118',
        congressNumber: 118,
        billType: 'HR',
        billNumber: 25,
        title: 'FairTax Act of 2023',
        shortTitle: 'FairTax Act of 2023',
        summary:
          'This bill imposes a national sales tax on the use or consumption in the United States of taxable property or services in lieu of the current income taxes.',
        status: 'IN_COMMITTEE',
        introducedDate: new Date('2023-01-09'),
        lastActionDate: new Date('2023-01-09'),
        dataSource: 'CONGRESS_GOV',
        dataQuality: 'VERIFIED',
        policyAreaId: policyAreas[1].id, // Taxation
      },
    }),
    prisma.bill.upsert({
      where: { id: 'hr-3935-118' },
      update: {},
      create: {
        id: 'hr-3935-118',
        congressNumber: 118,
        billType: 'HR',
        billNumber: 3935,
        title: 'FAA Reauthorization Act of 2024',
        shortTitle: 'FAA Reauthorization Act of 2024',
        summary:
          'This bill reauthorizes Federal Aviation Administration programs through FY2028 and addresses various aviation safety, infrastructure, and workforce issues.',
        status: 'TO_PRESIDENT',
        introducedDate: new Date('2023-06-06'),
        lastActionDate: new Date('2024-05-09'),
        dataSource: 'CONGRESS_GOV',
        dataQuality: 'VERIFIED',
      },
    }),
    prisma.bill.upsert({
      where: { id: 's-2226-118' },
      update: {},
      create: {
        id: 's-2226-118',
        congressNumber: 118,
        billType: 'S',
        billNumber: 2226,
        title: 'PRESS Act - Protect Reporters from Exploitative State Spying Act',
        shortTitle: 'PRESS Act',
        summary:
          'This bill establishes a federal privilege that limits the ability of federal authorities to compel journalists to disclose protected information.',
        status: 'PASSED_SENATE',
        introducedDate: new Date('2023-07-12'),
        lastActionDate: new Date('2024-07-30'),
        dataSource: 'CONGRESS_GOV',
        dataQuality: 'VERIFIED',
      },
    }),
  ]);
  console.log(`Created ${bills.length} bills`);

  // Create bill sponsors
  await Promise.all([
    prisma.billSponsor.upsert({
      where: { billId_legislatorId: { billId: 'hr-1-118', legislatorId: 'P000197' } },
      update: {},
      create: {
        billId: 'hr-1-118',
        legislatorId: 'P000197',
        isPrimary: false,
        cosponsorDate: new Date('2023-01-15'),
      },
    }),
    prisma.billSponsor.upsert({
      where: { billId_legislatorId: { billId: 's-1-118', legislatorId: 'M000355' } },
      update: {},
      create: {
        billId: 's-1-118',
        legislatorId: 'M000355',
        isPrimary: true,
      },
    }),
    prisma.billSponsor.upsert({
      where: { billId_legislatorId: { billId: 'hr-25-118', legislatorId: 'O000172' } },
      update: {},
      create: {
        billId: 'hr-25-118',
        legislatorId: 'O000172',
        isPrimary: false,
        cosponsorDate: new Date('2023-02-01'),
      },
    }),
  ]);
  console.log('Created bill sponsors');

  // Create committees
  const committees = await Promise.all([
    prisma.committee.upsert({
      where: { id: 'HSJU' },
      update: {},
      create: {
        id: 'HSJU',
        name: 'House Committee on the Judiciary',
        chamber: 'HOUSE',
        type: 'STANDING',
        jurisdiction: 'Civil and criminal judicial proceedings, federal courts and judges, bankruptcy',
      },
    }),
    prisma.committee.upsert({
      where: { id: 'SSFI' },
      update: {},
      create: {
        id: 'SSFI',
        name: 'Senate Committee on Finance',
        chamber: 'SENATE',
        type: 'STANDING',
        jurisdiction: 'Revenue measures, bonded debt, reciprocal trade agreements, tariffs, Social Security',
      },
    }),
    prisma.committee.upsert({
      where: { id: 'HSWM' },
      update: {},
      create: {
        id: 'HSWM',
        name: 'House Committee on Ways and Means',
        chamber: 'HOUSE',
        type: 'STANDING',
        jurisdiction: 'Revenue measures, bonded debt of the United States, tax policy',
      },
    }),
  ]);
  console.log(`Created ${committees.length} committees`);

  // Create a sample roll call vote
  const rollCallVote = await prisma.rollCallVote.upsert({
    where: { id: 'h2023-001' },
    update: {},
    create: {
      id: 'h2023-001',
      billId: 'hr-1-118',
      chamber: 'HOUSE',
      congressNumber: 118,
      session: 1,
      rollNumber: 1,
      voteType: 'ROLL_CALL',
      voteCategory: 'PASSAGE',
      question: 'On Passage: H.R. 1 Lower Energy Costs Act',
      result: 'PASSED',
      yeas: 225,
      nays: 204,
      present: 0,
      notVoting: 3,
      voteDate: new Date('2023-03-30'),
      dataSource: 'CONGRESS_GOV',
    },
  });
  console.log(`Created roll call vote: ${rollCallVote.id}`);

  // Create sample votes
  await Promise.all([
    prisma.vote.upsert({
      where: {
        rollCallId_legislatorId: {
          rollCallId: 'h2023-001',
          legislatorId: 'P000197',
        },
      },
      update: {},
      create: {
        rollCallId: 'h2023-001',
        legislatorId: 'P000197',
        position: 'NAY',
      },
    }),
    prisma.vote.upsert({
      where: {
        rollCallId_legislatorId: {
          rollCallId: 'h2023-001',
          legislatorId: 'O000172',
        },
      },
      update: {},
      create: {
        rollCallId: 'h2023-001',
        legislatorId: 'O000172',
        position: 'NAY',
      },
    }),
  ]);
  console.log('Created sample votes');

  // Create subjects
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { name: 'Climate change' },
      update: {},
      create: { name: 'Climate change' },
    }),
    prisma.subject.upsert({
      where: { name: 'Energy' },
      update: {},
      create: { name: 'Energy' },
    }),
    prisma.subject.upsert({
      where: { name: 'Oil and gas' },
      update: {},
      create: { name: 'Oil and gas' },
    }),
    prisma.subject.upsert({
      where: { name: 'National security' },
      update: {},
      create: { name: 'National security' },
    }),
    prisma.subject.upsert({
      where: { name: 'Income tax' },
      update: {},
      create: { name: 'Income tax' },
    }),
  ]);
  console.log(`Created ${subjects.length} subjects`);

  // Create bill subjects
  await Promise.all([
    prisma.billSubject.upsert({
      where: { billId_subjectId: { billId: 'hr-1-118', subjectId: subjects[1].id } },
      update: {},
      create: {
        billId: 'hr-1-118',
        subjectId: subjects[1].id,
        isPrimary: true,
      },
    }),
    prisma.billSubject.upsert({
      where: { billId_subjectId: { billId: 'hr-1-118', subjectId: subjects[2].id } },
      update: {},
      create: {
        billId: 'hr-1-118',
        subjectId: subjects[2].id,
        isPrimary: false,
      },
    }),
    prisma.billSubject.upsert({
      where: { billId_subjectId: { billId: 's-1-118', subjectId: subjects[3].id } },
      update: {},
      create: {
        billId: 's-1-118',
        subjectId: subjects[3].id,
        isPrimary: true,
      },
    }),
    prisma.billSubject.upsert({
      where: { billId_subjectId: { billId: 'hr-25-118', subjectId: subjects[4].id } },
      update: {},
      create: {
        billId: 'hr-25-118',
        subjectId: subjects[4].id,
        isPrimary: true,
      },
    }),
  ]);
  console.log('Created bill subjects');

  // Create a sample user
  const user = await prisma.user.upsert({
    where: { email: 'admin@ltip.dev' },
    update: {},
    create: {
      email: 'admin@ltip.dev',
      rateLimit: 1000,
    },
  });
  console.log(`Created user: ${user.email}`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
