import { useState } from "react";
import { useListFamilies } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Users } from "lucide-react";

export default function Families() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListFamilies({ search });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Families</h1>
        <button 
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
          data-testid="button-create-family"
        >
          Add Family
        </button>
      </div>
      
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input 
          placeholder="Search families by name or code..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus-visible:ring-amber-400 shadow-sm"
          data-testid="input-search-families"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </>
        ) : data?.data?.map((family) => (
          <div 
            key={family.id}
            className="bg-white rounded-2xl p-5 transition-all duration-300 border border-gray-100"
            style={{ boxShadow: "0 4px 6px -1px rgba(30,58,138,.05), 0 2px 4px -2px rgba(30,58,138,.05)" }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 15px -3px rgba(30,58,138,.1), 0 4px 6px -2px rgba(30,58,138,.05)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 6px -1px rgba(30,58,138,.05), 0 2px 4px -2px rgba(30,58,138,.05)";
              (e.currentTarget as HTMLElement).style.transform = "";
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800 font-bold">
                  {family.parent1?.firstName?.[0]}{family.parent1?.lastName?.[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                    {family.parent1?.firstName} {family.parent1?.lastName}
                  </h3>
                  {family.parent2 && (
                    <p className="text-sm text-gray-500">
                      & {family.parent2.firstName} {family.parent2.lastName}
                    </p>
                  )}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                {family.familyCode}
              </span>
            </div>
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-blue-800" />
                <span className="font-medium">{family.children?.length || 0}</span> Children
              </div>
              <Link href={`/families/${family.id}`}>
                <button 
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
                  data-testid={`link-family-${family.id}`}
                >
                  <Eye className="w-4 h-4" /> View Profile
                </button>
              </Link>
            </div>
          </div>
        ))}
        {data?.data?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No families found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
