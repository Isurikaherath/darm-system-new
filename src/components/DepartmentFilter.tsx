import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function useIsSuperAdmin() {
  const { data: user } = useCurrentUser();
  return !!user?.roles.includes("super_admin");
}

export function useDepartmentsList(enabled = true) {
  return useQuery({
    queryKey: ["all-departments"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
}

interface Props {
  value: string; // "all" or department id
  onChange: (v: string) => void;
  className?: string;
  label?: string;
}

/**
 * Department filter that renders ONLY for super admins.
 * Non-super-admins see nothing (returns null).
 */
export function DepartmentFilter({ value, onChange, className, label = "All departments" }: Props) {
  const isSuper = useIsSuperAdmin();
  const { data: depts } = useDepartmentsList(isSuper);
  if (!isSuper) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-56"}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {depts?.map((d) => (
          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
