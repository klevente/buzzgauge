import type { Route } from "./+types/home";
import { type ChartConfig, ChartContainer } from "~/components/ui/chart";
import { BeerIcon, Plus, Clock, Timer, Settings, Trash2 } from "lucide-react";
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
import { useState, useEffect, useMemo } from "react";
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
import { ThemeToggle } from "~/components/theme-toggle";

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
    // If drink is in the future, just add point where it reaches 0
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

type DeleteDialogProps = {
  drink?: Drink;
  onCancel: () => void;
  onConfirm: () => void;
};

const DeleteDialog: React.FC<DeleteDialogProps> = ({
  drink,
  onCancel,
  onConfirm,
}) => {
  if (!drink) {
    return;
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Drink</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this drink ({drink.volume}ml,{" "}
            {drink.alcoholPercentage}%)? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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

  const [drinks, setDrinks] = useState<Drink[]>(() => {
    const stored = localStorage.getItem("drinks");
    if (!stored) {
      return [];
    }

    try {
      const storedDrinks = JSON.parse(stored) as Drink[];
      // Clear drinks if user is already sober
      if (
        calculateBac(
          storedDrinks,
          DEFAULT_SETTINGS.gender,
          Date.now(),
          DEFAULT_SETTINGS.weight,
        ) <= 0
      ) {
        localStorage.removeItem("drinks");
        return [];
      }
      return storedDrinks;
    } catch {
      return [];
    }
  });

  // Save drinks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("drinks", JSON.stringify(drinks));
  }, [drinks]);

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drinkToDelete, setDrinkToDelete] = useState<
    { drink: Drink; index: number } | undefined
  >();
  const [newDrink, setNewDrink] = useState<Partial<Drink>>({
    alcoholPercentage: 5,
    volume: 500,
  });
  const [settings, setSettings] = useState<UserSettings>(() => {
    const stored = localStorage.getItem("userSettings");
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

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

  const bac = useMemo(
    () => calculateBac(drinks, settings.gender, currentTime, settings.weight),
    [drinks, settings.gender, currentTime, settings.weight],
  );

  // Memoize derived values
  const { isOverLimit, timeUntilSober, timeUntilLegal, soberTime, legalTime } =
    useMemo(() => {
      const isOverLimit = bac > settings.bacLimit;
      const timeUntilSoberUnformatted = estimateTimeUntilTarget(bac, 0);
      const timeUntilLegalUnformatted = estimateTimeUntilTarget(
        bac,
        settings.bacLimit,
      );

      return {
        isOverLimit,
        timeUntilSober: timeFormat.format(new Date(timeUntilSoberUnformatted)),
        timeUntilLegal: timeFormat.format(new Date(timeUntilLegalUnformatted)),
        soberTime: soberTimeFormat.format(
          new Date(currentTime + timeUntilSoberUnformatted),
        ),
        legalTime: soberTimeFormat.format(
          new Date(currentTime + timeUntilLegalUnformatted),
        ),
      };
    }, [bac, settings.bacLimit, currentTime]);

  // Memoize chart data
  const chartData = useMemo(
    () =>
      calculateChartData(drinks, settings.gender, currentTime, settings.weight),
    [drinks, settings.gender, currentTime, settings.weight],
  );

  // Check if user is sober and clear drinks if needed
  useEffect(() => {
    if (bac <= 0 && drinks.length > 0) {
      setDrinks([]);
      toast({
        title: "Session Cleared",
        description:
          "Your drinking session has been cleared as you are now sober.",
      });
    }
  }, [bac, drinks.length]);

  const chartConfig = {
    bac: {
      label: "BAC",
      icon: BeerIcon,
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  // Calculate chart domain based on data availability
  const chartDomain: [number, number] = useMemo(
    () =>
      drinks.length === 0
        ? [currentTime - 30 * 60 * 1000, currentTime + 30 * 60 * 1000] // 30 minutes before and after current time if no drinks
        : [
            Math.min(chartData[0]?.timestamp ?? currentTime, currentTime) -
              5 * 60 * 1000,
            Math.max(chartData.at(-1)?.timestamp ?? currentTime, currentTime) +
              5 * 60 * 1000,
          ],
    [drinks.length, currentTime, chartData],
  );

  const handleDeleteDrink = (index: number) => {
    const updatedDrinks = drinks.filter(
      (_, drinkIndex) => drinkIndex !== index,
    );
    setDrinks(updatedDrinks);
    toast({
      title: "Drink Deleted",
      description: "The drink has been removed from your log.",
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 max-w-5xl">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold">BuzzGauge</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
                  Configure your personal details for more accurate
                  calculations.
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
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDrinks([]);
                    toast({
                      title: "Session Cleared",
                      description:
                        "All drinks have been deleted. This action cannot be undone.",
                    });
                    setSettingsOpen(false);
                  }}
                >
                  Delete All Drinks
                </Button>
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
        </div>
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
                Legal at {legalTime}
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
                Sober at {soberTime}
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
                  domain={chartDomain}
                  ticks={(() => {
                    const [domainStart, domainEnd] = chartDomain;
                    const duration = domainEnd - domainStart;
                    const tickCount = 6;
                    const interval = duration / (tickCount - 1);
                    return Array.from(
                      { length: tickCount },
                      (_, index) => domainStart + interval * index,
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
                  strokeWidth={2}
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
            {drinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground space-y-2">
                <BeerIcon className="h-8 w-8 mb-2 opacity-50" />
                <p>No drinks logged yet.</p>
                <p className="text-sm">Click "Add Drink" to get started.</p>
              </div>
            ) : (
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
                      <TableCell className="flex items-center justify-between">
                        <span>{drink.alcoholPercentage}%</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setDrinkToDelete({ drink, index });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <DeleteDialog
        drink={drinkToDelete?.drink}
        onCancel={() => {
          setDrinkToDelete(undefined);
        }}
        onConfirm={() => {
          if (drinkToDelete) {
            handleDeleteDrink(drinkToDelete.index);
          }
        }}
      />
    </div>
  );
}
