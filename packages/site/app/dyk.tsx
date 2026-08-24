"use client";

const url = {
  gh: "https://github.com/HKUST-CRS/crs",
  team: "https://github.com/HKUST-CRS/reports",
  desmond: "https://www.cse.ust.hk/~desmond/",
  psetup: "https://myaccount.ust.hk/psetup/connect/",
  discord: "https://discord.gg/D5Ht35RW6B",
};

const facts = [
  <>
    CRS is open source! Check it out at{" "}
    <a href={url.gh}>
      <u>HKUST-CRS/crs</u>
    </a>
    !
  </>,
  <>
    CRS is developed by{" "}
    <a href={url.team}>
      <u>a team of HKUST students</u>
    </a>
    .
  </>,
  <>
    There is a{" "}
    <a href={url.discord}>
      <u>Discord server</u>
    </a>{" "}
    for CRS users and developers!
  </>,
  <>
    CRS is an Independent Work project supervised by{" "}
    <a href={url.desmond}>
      <u>Dr. Desmond Tsoi</u>
    </a>
    .
    <br />
    Reach out to him if you're interested!
  </>,
  <>
    You can change your CRS display name via{" "}
    <a href={url.psetup}>
      <u>this ITSC service page</u>
    </a>
    .
  </>,
];

export function DYK() {
  // Seed the pick by UTC day so the server render and client hydration agree.
  const fact = facts[Math.floor(Date.now() / 86_400_000) % facts.length];
  return (
    <div className="fixed top-4 left-4 z-[8] text-gray-500 text-xs">
      <div className="font-medium text-[0.675rem] uppercase">
        DID YOU KNOW...?
      </div>
      <div className="px-2 py-1">{fact}</div>
    </div>
  );
}
