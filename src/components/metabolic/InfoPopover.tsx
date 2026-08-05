import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InfoPopover({ title, body }: { title: string; body: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`What is ${title}?`}
        className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm">
        <p className="mb-1 font-medium">{title}</p>
        <p className="text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  );
}