import { useEffect } from "react";
import { useGetRecruiterProfile, useUpdateRecruiterProfile, getGetRecruiterProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User, Building } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  companyName: z.string().min(2, "Company name must be at least 2 characters").optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function RecruiterProfile() {
  const { data: profile, isLoading } = useGetRecruiterProfile();
  const queryClient = useQueryClient();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      companyName: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.displayName || "",
        companyName: profile.companyName || "",
      });
    }
  }, [profile, form]);

  const updateMutation = useUpdateRecruiterProfile({
    mutation: {
      onSuccess: () => {
        toast.success("Profile updated successfully");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterProfileQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update profile");
      }
    }
  });

  const onSubmit = (data: ProfileValues) => {
    updateMutation.mutate({ data });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-2xl">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl shadow-lg border-t-4 border-t-indigo-600">
        <CardHeader className="text-center pb-8 border-b bg-slate-50/50">
          <div className="mx-auto w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-700 shadow-sm border border-indigo-200">
            <User className="w-10 h-10" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-900">Recruiter Profile</CardTitle>
          <CardDescription className="text-base mt-2">Manage your personal and company information</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  Account Details (Read Only)
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-slate-500 block mb-1">Email Address</span>
                    <span className="text-slate-900 font-medium">{profile?.email}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-500 block mb-1">Account Role</span>
                    <span className="text-slate-900 font-medium capitalize">{profile?.role}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input className="pl-10 h-12 text-lg" placeholder="Jane Smith" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Company Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Building className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input className="pl-10 h-12 text-lg" placeholder="Acme Corp" {...field} value={field.value || ""} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-6 flex justify-end">
                <Button type="submit" size="lg" disabled={updateMutation.isPending} className="w-full md:w-auto px-8">
                  {updateMutation.isPending ? "Saving Changes..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}