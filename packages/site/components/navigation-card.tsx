"use client";

import Link from "next/link";
import type { FC, ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";

export type NavigationCardProps = {
  title: ReactNode;
  description: ReactNode;
  target: string;
};

export const NavigationCard: FC<NavigationCardProps> = (props) => {
  return (
    <Link href={props.target}>
      <Card className="hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 cursor-pointer">
        <CardHeader>
          <CardTitle className="text-xl">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
};
