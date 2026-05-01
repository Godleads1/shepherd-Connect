import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useCreateFamily, useCreateChild } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const step1Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Required"),
  password: z.string().min(6, "Minimum 6 characters"),
});

const step2Schema = z.object({
  hasSpouse: z.boolean(),
  spouseFirstName: z.string().optional(),
  spouseLastName: z.string().optional(),
  spouseEmail: z.string().optional(),
  spousePhone: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().min(1, "Required"),
  emergencyContactPhone: z.string().min(1, "Required"),
});

const childSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dob: z.string().min(1, "Required"),
  gender: z.enum(["male", "female"]),
  allergies: z.string().optional(),
});

const step3Schema = z.object({
  children: z.array(childSchema).min(1, "Add at least one child"),
});

export default function Register() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { login: localLogin } = useAuth();
  const { toast } = useToast();
  
  const [step1Data, setStep1Data] = useState<z.infer<typeof step1Schema> | null>(null);
  const [step2Data, setStep2Data] = useState<z.infer<typeof step2Schema> | null>(null);

  const registerMutation = useRegister();
  const createFamilyMutation = useCreateFamily();
  const createChildMutation = useCreateChild();

  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "" },
  });

  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { hasSpouse: false, spouseFirstName: "", spouseLastName: "", spouseEmail: "", spousePhone: "", address: "", emergencyContactName: "", emergencyContactPhone: "" },
  });

  const form3 = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: { children: [{ firstName: "", lastName: "", dob: "", gender: "male", allergies: "" }] },
  });

  const { fields: childFields, append: appendChild, remove: removeChild } = useFieldArray({
    control: form3.control,
    name: "children",
  });

  const onStep1Submit = (data: z.infer<typeof step1Schema>) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: z.infer<typeof step2Schema>) => {
    setStep2Data(data);
    setStep(3);
  };

  const onStep3Submit = async (data: z.infer<typeof step3Schema>) => {
    if (!step1Data || !step2Data) return;

    try {
      // 1. Register main parent
      const authRes = await registerMutation.mutateAsync({
        data: {
          firstName: step1Data.firstName,
          lastName: step1Data.lastName,
          email: step1Data.email,
          phone: step1Data.phone,
          password: step1Data.password,
          role: "parent"
        }
      });
      
      localLogin(authRes.token, authRes.user);

      let parent2Id = null;
      if (step2Data.hasSpouse && step2Data.spouseEmail) {
        // Register spouse (mocked as register since no direct user create for open endpoint)
        // For reality, you might need a different endpoint, but let's just create family with parent1 for now
      }

      // 2. Create Family
      const family = await createFamilyMutation.mutateAsync({
        data: {
          parent1Id: authRes.user.id,
          parent2Id: parent2Id,
          address: step2Data.address,
          emergencyContactName: step2Data.emergencyContactName,
          emergencyContactPhone: step2Data.emergencyContactPhone
        }
      });

      // 3. Create Children
      for (const child of data.children) {
        await createChildMutation.mutateAsync({
          data: {
            familyId: family.id,
            firstName: child.firstName,
            lastName: child.lastName || step1Data.lastName,
            dob: child.dob,
            gender: child.gender,
            allergies: child.allergies
          }
        });
      }

      toast({ title: "Registration complete!" });
      setLocation("/my-family");
    } catch (error) {
      toast({ variant: "destructive", title: "Registration failed", description: "Please try again." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Register Family</CardTitle>
          <CardDescription>Step {step} of 3</CardDescription>
          <div className="flex gap-2 mt-4">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <Form {...form1}>
              <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form1.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} data-testid="reg-fname" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form1.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} data-testid="reg-lname" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form1.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} data-testid="reg-email" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form1.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+234..." {...field} data-testid="reg-phone" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form1.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} data-testid="reg-pass" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex justify-between items-center pt-4">
                  <Link href="/login" className="text-sm text-primary hover:underline">Back to login</Link>
                  <Button type="submit" data-testid="reg-step1-next">Next <ChevronRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </form>
            </Form>
          )}

          {step === 2 && (
            <Form {...form2}>
              <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
                <FormField control={form2.control} name="hasSpouse" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Add Spouse</FormLabel>
                      <div className="text-sm text-muted-foreground">Register a second parent/guardian</div>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="reg-spouse-toggle" /></FormControl>
                  </FormItem>
                )} />
                
                {form2.watch("hasSpouse") && (
                  <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                    <FormField control={form2.control} name="spouseFirstName" render={({ field }) => (
                      <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form2.control} name="spouseLastName" render={({ field }) => (
                      <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form2.control} name="spouseEmail" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form2.control} name="spousePhone" render={({ field }) => (
                      <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                )}

                <FormField control={form2.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Home Address</FormLabel><FormControl><Input {...field} data-testid="reg-address" /></FormControl><FormMessage /></FormItem>
                )} />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form2.control} name="emergencyContactName" render={({ field }) => (
                    <FormItem><FormLabel>Emergency Contact</FormLabel><FormControl><Input {...field} data-testid="reg-emerg-name" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form2.control} name="emergencyContactPhone" render={({ field }) => (
                    <FormItem><FormLabel>Emergency Phone</FormLabel><FormControl><Input {...field} data-testid="reg-emerg-phone" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button type="submit" data-testid="reg-step2-next">Next <ChevronRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </form>
            </Form>
          )}

          {step === 3 && (
            <Form {...form3}>
              <form onSubmit={form3.handleSubmit(onStep3Submit)} className="space-y-6">
                {childFields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-card">
                    {index > 0 && (
                      <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 text-destructive" onClick={() => removeChild(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <h4 className="font-semibold text-primary">Child {index + 1}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form3.control} name={`children.${index}.firstName`} render={({ field }) => (
                        <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} data-testid={`reg-child-fname-${index}`} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form3.control} name={`children.${index}.lastName`} render={({ field }) => (
                        <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} data-testid={`reg-child-lname-${index}`} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form3.control} name={`children.${index}.dob`} render={({ field }) => (
                        <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} data-testid={`reg-child-dob-${index}`} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form3.control} name={`children.${index}.gender`} render={({ field }) => (
                        <FormItem><FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger data-testid={`reg-child-gender-${index}`}><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        <FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form3.control} name={`children.${index}.allergies`} render={({ field }) => (
                      <FormItem><FormLabel>Allergies / Medical Notes</FormLabel><FormControl><Input placeholder="Optional" {...field} data-testid={`reg-child-allergies-${index}`} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                ))}

                <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendChild({ firstName: "", lastName: step1Data?.lastName || "", dob: "", gender: "male", allergies: "" })}>
                  <Plus className="w-4 h-4 mr-2" /> Add Another Child
                </Button>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" disabled={registerMutation.isPending || createFamilyMutation.isPending || createChildMutation.isPending} data-testid="reg-submit">
                    {registerMutation.isPending ? "Registering..." : <><Check className="w-4 h-4 mr-2" /> Complete Registration</>}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
