import { useState } from "react";
import { useListChildren } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Search, Eye, AlertCircle, Baby, MapPin } from "lucide-react";

export default function Children() {
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const { data, isLoading } = useListChildren({ search, unassigned: unassignedOnly });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Children</h1>
        <button 
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
          data-testid="button-create-child"
        >
          Add Child
        </button>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search children..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus-visible:ring-[#1a237e] shadow-sm"
            data-testid="input-search-children"
          />
        </div>
        <div className="flex items-center space-x-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
          <Switch 
            id="unassigned" 
            checked={unassignedOnly} 
            onCheckedChange={setUnassignedOnly}
            data-testid="switch-unassigned"
          />
          <label htmlFor="unassigned" className="text-sm font-medium text-gray-700 cursor-pointer">
            Unassigned Only
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </>
        ) : data?.data?.map((child) => (
          <div 
            key={child.id}
            className="bg-white rounded-2xl p-5 transition-all duration-300 border border-gray-100 flex flex-col h-full"
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
            {child.allergies && (
              <div className="mb-3 -mt-1 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1.5 w-fit uppercase tracking-wider">
                <AlertCircle className="w-3 h-3 text-red-500" /> Medical / Allergy
              </div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {child.firstName} {child.lastName}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">Age {child.age}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800 font-bold">
                {child.firstName[0]}{child.lastName?.[0]}
              </div>
            </div>
            
            <div className="mt-auto pt-4 flex items-center justify-between">
              {child.currentClass ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                  <MapPin className="w-3 h-3" /> {child.currentClass.name}
                </div>
              ) : (
                <div className="text-xs font-semibold text-[#1a237e] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  Unassigned
                </div>
              )}
              
              <Link href={`/children/${child.id}`}>
                <button 
                  className="text-sm font-semibold text-blue-800 hover:text-blue-900 flex items-center gap-1 transition-colors"
                  data-testid={`link-child-${child.id}`}
                >
                  <Eye className="w-4 h-4" /> View
                </button>
              </Link>
            </div>
          </div>
        ))}
        {data?.data?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Baby className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No children found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
