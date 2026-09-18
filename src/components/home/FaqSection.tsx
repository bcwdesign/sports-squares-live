import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "./Reveal";

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Clutch Squares?",
    a: "Clutch Squares is an interactive game-day platform. A host creates a private 10×10 squares board for a live football or basketball game, invites their company, group or friends, and everyone follows the board together as the score updates.",
  },
  {
    q: "How do squares work?",
    a: "Each board has 100 squares. One team's digits 0–9 run across the top, the other team's run down the side. When a scoring period ends, the last digit of each team's score points to one square — that square is the winner for that period.",
  },
  {
    q: "Can I create a private game?",
    a: "Yes. Every game is private by default and joined with an invite code, so only the people you share the code with can take part.",
  },
  {
    q: "Can companies use Clutch Squares?",
    a: "Yes. Companies are a primary use case. A host can create a private board for their organization, share one invite code, apply company branding, and bring remote and in-office teams into the same game-day moment.",
  },
  {
    q: "How many people can participate?",
    a: "A board has 100 squares, and the host chooses how many squares each person can claim — so anywhere from a small team up to a hundred participants on a single board.",
  },
  {
    q: "What sports are supported?",
    a: "Football and basketball games are supported, with live scores for each period of play.",
  },
  {
    q: "How do employees join?",
    a: "They open Clutch Squares, sign in, and enter the invite code the host shared. No installation or spreadsheet setup is needed.",
  },
  {
    q: "Is Clutch Squares a sportsbook or gambling platform?",
    a: "No. Clutch Squares is an engagement product. It provides the board, the invite flow and the live score display for a group to follow a game together. It does not process entry fees, take bets or handle any money.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 px-4 sm:px-8 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">FAQ</p>
          <h2 className="mt-4 font-display font-bold text-3xl sm:text-5xl tracking-tight">
            Questions, answered.
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left font-display font-bold text-base sm:text-lg hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
