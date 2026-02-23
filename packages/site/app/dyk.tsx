"use client";

import { sample } from "es-toolkit";
import { useMemo } from "react";

const url = {
  gh: "https://github.com/HKUST-CRS/crs",
  team: "https://github.com/HKUST-CRS/reports",
  desmond: "https://www.cse.ust.hk/~desmond/",
  psetup: "https://myaccount.ust.hk/psetup/connect/",
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
  const fact = useMemo(() => sample(facts), []);
  return (
    <div className="absolute top-4 left-4 text-gray-500 text-xs">
      <div className="font-medium text-[0.675rem] uppercase">
        DID YOU KNOW...?
      </div>
      <div className="px-2 py-1">{fact}</div>
    </div>
  );
}
