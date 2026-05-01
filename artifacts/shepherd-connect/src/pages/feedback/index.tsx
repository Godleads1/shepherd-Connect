import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitFeedback } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

const formSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  classExperience: z.number().min(1).max(5),
  teacherEngagement: z.number().min(1).max(5),
  safetyRating: z.number().min(1).max(5),
  improvementNote: z.string().optional(),
});

export default function Feedback() {
  const mutation = useSubmitFeedback();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rating: 0,
      classExperience: 0,
      teacherEngagement: 0,
      safetyRating: 0,
      improvementNote: "",
    }
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await mutation.mutateAsync({
        data: {
          ...data,
          serviceDate: format(new Date(), 'yyyy-MM-dd')
        }
      });
      setSubmitted(true);
      toast({ title: "Thank you for your feedback!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to submit feedback" });
    }
  };

  const StarRating = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star 
          key={star}
          className={`w-8 h-8 cursor-pointer transition-colors ${star <= value ? 'fill-accent text-accent' : 'text-muted-foreground'}`}
          onClick={() => onChange(star)}
        />
      ))}
    </div>
  );

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
        <div className="bg-success/10 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
          <Star className="w-12 h-12 text-success fill-success" />
        </div>
        <h1 className="text-3xl font-bold text-primary">Thank You!</h1>
        <p className="text-muted-foreground text-lg">Your feedback helps us create a better, safer environment for our children.</p>
        <Button onClick={() => setSubmitted(false)} variant="outline">Submit another</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary">Service Feedback</h1>
        <p className="text-muted-foreground">How was your child's experience today?</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <FormField control={form.control} name="rating" render={({ field }) => (
                <FormItem className="flex flex-col items-center">
                  <FormLabel className="text-lg font-bold mb-2">Overall Experience</FormLabel>
                  <FormControl><StarRating value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid md:grid-cols-3 gap-6 pt-6 border-t">
                <FormField control={form.control} name="classExperience" render={({ field }) => (
                  <FormItem className="flex flex-col items-center text-center">
                    <FormLabel>Class Quality</FormLabel>
                    <FormControl><StarRating value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="teacherEngagement" render={({ field }) => (
                  <FormItem className="flex flex-col items-center text-center">
                    <FormLabel>Teacher Engagement</FormLabel>
                    <FormControl><StarRating value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="safetyRating" render={({ field }) => (
                  <FormItem className="flex flex-col items-center text-center">
                    <FormLabel>Safety Perception</FormLabel>
                    <FormControl><StarRating value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="improvementNote" render={({ field }) => (
                <FormItem className="pt-6 border-t">
                  <FormLabel>Any notes or suggestions? (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Share your thoughts..." className="h-24" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-12 text-lg gap-2" disabled={mutation.isPending}>
                <Send className="w-5 h-5" /> Submit Feedback
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
