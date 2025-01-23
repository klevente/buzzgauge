import type { Route } from "./+types/home";
import { type ChartConfig, ChartContainer } from "~/components/ui/chart";
import { BeerIcon, Plus, Clock, Timer, Settings } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/hooks/use-toast";
import { Slider } from "~/components/ui/slider";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "BuzzGauge" },
    { name: "description", content: "BuzzGauge - Alcohol Tracker" },
  ];
}

const GENDER_CONSTANTS = {
  male: 0.68,
  female: 0.55,
} as const;
type Gender = keyof typeof GENDER_CONSTANTS;

// Constants for BAC calculation
const METABOLISM_RATE = 0.015; // Average rate of alcohol metabolism per hour

type Drink = {
  timestamp: number;
  volume: number;
  alcoholPercentage: number;
};

function calculateBac(
  drinks: Drink[],
  gender: Gender,
  timestamp: number,
  weight: number,
): number {
  let result = 0;
  const genderConstant = GENDER_CONSTANTS[gender];
  for (const drink of drinks) {
    if (drink.timestamp > timestamp) {
      continue;
    }

    const hoursSinceDrink = (timestamp - drink.timestamp) / (60 * 60 * 1000);
    const alcoholGrams = drink.volume * (drink.alcoholPercentage / 100) * 0.789;
    const initialBAC = (alcoholGrams / (weight * 1000 * genderConstant)) * 100;

    result += Math.max(0, initialBAC - METABOLISM_RATE * hoursSinceDrink);
  }

  return result;
}

type DataPoint = {
  timestamp: number;
  bac: number;
  isPeak: boolean;
};

function calculateChartData(
  drinks: Drink[],
  gender: Gender,
  now: number,
  weight: number,
): DataPoint[] {
  const result: DataPoint[] = [];
  const sortedDrinks = [...drinks].sort((a, b) => a.timestamp - b.timestamp);

  if (sortedDrinks.length === 0) {
    return result;
  }

  // Start with 0 BAC at the first drink's time
  /*result.push({
    timestamp: sortedDrinks[0]!.timestamp - 1000, // 1 second before first drink
    bac: 0,
  });*/

  let currentBac = 0;

  for (const drink of sortedDrinks) {
    // Add point just before the drink at current BAC level
    result.push({
      timestamp: drink.timestamp,
      bac: currentBac,
      isPeak: false,
    });

    // Calculate BAC increase from this drink
    const genderConstant = GENDER_CONSTANTS[gender];
    const alcoholGrams = drink.volume * (drink.alcoholPercentage / 100) * 0.789;
    const bacIncrease = (alcoholGrams / (weight * 1000 * genderConstant)) * 100;

    // Add point immediately after adding the drink
    currentBac += bacIncrease;
    result.push({
      timestamp: drink.timestamp,
      bac: currentBac,
      isPeak: false,
    });

    // Calculate when this drink's BAC would reach 0 if no other drinks
    const hoursUntilZero = currentBac / METABOLISM_RATE;
    const timeUntilZero = hoursUntilZero * 60 * 60 * 1000;
    const zeroTime = drink.timestamp + timeUntilZero;

    // If there's another drink, add point at that time with calculated BAC
    const nextDrink = sortedDrinks.find((d) => d.timestamp > drink.timestamp);
    if (nextDrink) {
      const hoursTillNextDrink =
        (nextDrink.timestamp - drink.timestamp) / (60 * 60 * 1000);
      currentBac = Math.max(
        0,
        currentBac - METABOLISM_RATE * hoursTillNextDrink,
      );
    }
    // If no next drink, add point at current time if not in future
    else if (now > drink.timestamp) {
      const hoursSinceDrink = (now - drink.timestamp) / (60 * 60 * 1000);
      currentBac = Math.max(0, currentBac - METABOLISM_RATE * hoursSinceDrink);
      result.push({
        timestamp: now,
        bac: currentBac,
        isPeak: false,
      });

      // If still above 0, add final point where it reaches 0
      if (currentBac > 0) {
        result.push({
          timestamp: zeroTime,
          bac: 0,
          isPeak: false,
        });
      }
    }
    // If drink is in future, just add point where it reaches 0
    else {
      result.push({
        timestamp: zeroTime,
        bac: 0,
        isPeak: false,
      });
    }
  }

  return result;
}

function estimateTimeUntilTarget(
  currentBac: number,
  targetBac: number,
): number {
  if (currentBac <= targetBac) {
    return 0;
  }
  return ((currentBac - targetBac) / METABOLISM_RATE) * 60 * 60 * 1000;
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const tickFormatter = (value: number) => timeFormat.format(new Date(value));

// const labelFormatter = (value: string) => labelFormat.format(new Date(value));

const soberTimeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  hour12: true,
});

const drinkLogTimeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function clientLoader({}: Route.ClientLoaderArgs) {
  // const now = Date.now();
  const now = new Date(2024, 1, 1).getTime();
  const testDrinks = [
    {
      timestamp: now,
      alcoholPercentage: 5,
      volume: 500,
    },
    {
      timestamp: now - 60 * 60 * 1000,
      alcoholPercentage: 5,
      volume: 500,
    },
    {
      timestamp: now - 2 * 60 * 60 * 1000,
      alcoholPercentage: 5,
      volume: 500,
    },
  ] satisfies Drink[];

  return {
    drinks: testDrinks,
    now,
  };
}

export type UserSettings = {
  gender: Gender;
  weight: number;
  bacLimit: number;
};

// This would typically come from your backend/storage
const DEFAULT_SETTINGS: UserSettings = {
  gender: "male",
  weight: 75,
  bacLimit: 0.05,
};

export default function Home({}: Route.ComponentProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const [drinks, setDrinks] = useState<Drink[]>([
    {
      timestamp: Date.now(),
      alcoholPercentage: 5,
      volume: 500,
    },
    {
      timestamp: Date.now() - 60 * 60 * 1000,
      alcoholPercentage: 5,
      volume: 500,
    },
    {
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      alcoholPercentage: 5,
      volume: 500,
    },
  ]);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDrink, setNewDrink] = useState<Partial<Drink>>({
    alcoholPercentage: 5,
    volume: 500,
  });
  const [settings, setSettings] = useState<UserSettings>(() => {
    const stored = localStorage.getItem("userSettings");
    if (!stored) return DEFAULT_SETTINGS;

    try {
      const parsed = JSON.parse(stored) as Partial<UserSettings>;
      return {
        gender: parsed.gender ?? DEFAULT_SETTINGS.gender,
        weight: parsed.weight ?? DEFAULT_SETTINGS.weight,
        bacLimit: parsed.bacLimit ?? DEFAULT_SETTINGS.bacLimit,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const handleSettingsChange = (newSettings: Partial<UserSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem("userSettings", JSON.stringify(updatedSettings));
  };

  const handleAddDrink = (event: React.FormEvent) => {
    event.preventDefault();
    if (newDrink.alcoholPercentage && newDrink.volume) {
      const drink = {
        timestamp: currentTime,
        alcoholPercentage: newDrink.alcoholPercentage,
        volume: newDrink.volume,
      };
      setDrinks([...drinks, drink]);
      toast({
        title: "Drink Added",
        description: `Added ${drink.volume.toString()}ml drink with ${drink.alcoholPercentage.toString()}% alcohol.`,
      });
      setOpen(false);
    }
  };

  const bac = calculateBac(
    drinks,
    settings.gender,
    currentTime,
    settings.weight,
  );
  const isOverLimit = bac > settings.bacLimit;
  const timeUntilSoberUnformatted = estimateTimeUntilTarget(bac, 0);
  const timeUntilLegalUnformatted = estimateTimeUntilTarget(
    bac,
    settings.bacLimit,
  );
  const timeUntilSober = timeFormat.format(new Date(timeUntilSoberUnformatted));
  const timeUntilLegal = timeFormat.format(new Date(timeUntilLegalUnformatted));
  const chartData = calculateChartData(
    drinks,
    settings.gender,
    currentTime,
    settings.weight,
  );

  const chartConfig = {
    bac: {
      label: "BAC",
      icon: BeerIcon,
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 max-w-5xl">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold">BuzzGauge</h1>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <button className="p-2 hover:bg-accent rounded-full">
              <Settings className="h-6 w-6" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Configure your personal details for more accurate calculations.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={settings.gender}
                  onValueChange={(value: "male" | "female") => {
                    handleSettingsChange({ gender: value });
                  }}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="weight"
                    min={30}
                    max={200}
                    step={1}
                    value={[settings.weight]}
                    onValueChange={(value) => {
                      handleSettingsChange({ weight: value[0]! });
                    }}
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-sm text-muted-foreground">
                    {settings.weight}kg
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bacLimit">Legal BAC Limit (%)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="bacLimit"
                    min={0}
                    max={0.08}
                    step={0.01}
                    value={[settings.bacLimit]}
                    onValueChange={(value) => {
                      handleSettingsChange({ bacLimit: value[0]! });
                    }}
                    className="flex-1"
                  />
                  <span className="w-16 text-right text-sm text-muted-foreground">
                    {settings.bacLimit.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSettingsOpen(false);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <main className="space-y-6 md:space-y-8">
        <div className="grid gap-3 md:gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current BAC</CardTitle>
              <BeerIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isOverLimit && "text-destructive",
                )}
              >
                {bac.toFixed(3)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Blood Alcohol Content
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Time Until Legal
              </CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{timeUntilLegal}</div>
              <p className="text-xs text-muted-foreground">
                Legal at{" "}
                {soberTimeFormat.format(
                  currentTime + timeUntilLegalUnformatted,
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Time Until Sober
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{timeUntilSober}</div>
              <p className="text-xs text-muted-foreground">
                Sober at{" "}
                {soberTimeFormat.format(
                  currentTime + timeUntilSoberUnformatted,
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>BAC Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                  bottom: 10,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={24}
                  tickFormatter={tickFormatter}
                  type="number"
                  scale="time"
                  domain={[
                    chartData[0]!.timestamp - 5 * 60 * 1000,
                    chartData.at(-1)!.timestamp + 5 * 60 * 1000,
                  ]}
                  ticks={(() => {
                    const start = chartData[0]!.timestamp;
                    const end = chartData.at(-1)!.timestamp;
                    const duration = end - start;
                    const tickCount = 6;
                    const interval = duration / (tickCount - 1);
                    return Array.from(
                      { length: tickCount },
                      (_, index) => start + interval * index,
                    );
                  })()}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ReferenceLine
                  y={settings.bacLimit}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="3 3"
                />
                <Area
                  type="linear"
                  dataKey="bac"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  type="linear"
                  dataKey={({ bac, isPeak }: DataPoint) =>
                    isPeak ? bac : undefined
                  }
                  stroke="none"
                  fill="none"
                  dot={{
                    r: 4,
                    fill: "hsl(var(--chart-1))",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Drink Log</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Drink
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Drink</DialogTitle>
                  <DialogDescription>
                    Enter the details of your drink below. You should add the
                    drink when you just finished it.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddDrink}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="volume">Volume (ml)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="volume"
                          min={30}
                          max={500}
                          step={10}
                          value={[newDrink.volume ?? 330]}
                          onValueChange={(value) => {
                            setNewDrink({
                              ...newDrink,
                              volume: value[0],
                            });
                          }}
                          className="flex-1"
                        />
                        <span className="w-16 text-right text-sm text-muted-foreground">
                          {newDrink.volume}ml
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Shot</span>
                        <span>Small Beer</span>
                        <span>Large Beer</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="alcoholPercentage">Alcohol %</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="alcoholPercentage"
                          min={2}
                          max={45}
                          step={0.5}
                          value={[newDrink.alcoholPercentage ?? 5]}
                          onValueChange={(value) => {
                            setNewDrink({
                              ...newDrink,
                              alcoholPercentage: value[0],
                            });
                          }}
                          className="flex-1"
                        />
                        <span className="w-16 text-right text-sm text-muted-foreground">
                          {newDrink.alcoholPercentage?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Light Beer</span>
                        <span>Wine</span>
                        <span>Spirit</span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Add Drink</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Volume (ml)</TableHead>
                  <TableHead>Alcohol %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drinks.map((drink, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {drinkLogTimeFormat.format(drink.timestamp)}
                    </TableCell>
                    <TableCell>{drink.volume}</TableCell>
                    <TableCell>{drink.alcoholPercentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
