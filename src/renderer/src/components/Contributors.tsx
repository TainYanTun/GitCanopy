import React, { useState, useEffect, useRef, useMemo } from "react";
import { ContributorStats } from "@shared/types";
import moment from "moment";
import * as d3 from "d3";
import { Avatar } from "./Avatar";

interface ContributorsProps {
  repoPath: string;
}

export const Contributors: React.FC<ContributorsProps> = ({ repoPath }) => {
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<SVGSVGElement | null>(null);

  // Calculate aggregated activity for the main graph
  const aggregatedActivity = useMemo(() => {
    if (contributors.length === 0) return [];
    const buckets = contributors[0].activity.length;
    const result = new Array(buckets).fill(0);
    
    contributors.forEach(c => {
      c.activity.forEach((val, i) => {
        result[i] += val;
      });
    });
    return result;
  }, [contributors]);

  useEffect(() => {
    const fetchContributors = async () => {
      setLoading(true);
      try {
        const data = await window.gitcanopyAPI.getContributors(repoPath);
        setContributors(data);
      } catch (error) {
        console.error("Failed to fetch contributors:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContributors();
  }, [repoPath]);

  // Render D3 Area Chart
  useEffect(() => {
    if (loading || aggregatedActivity.length === 0 || !chartRef.current) return;

    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove();

    const width = chartRef.current.clientWidth;
    const height = 120;
    const margin = { top: 10, right: 0, bottom: 0, left: 0 };

    const x = d3.scaleLinear()
      .domain([0, aggregatedActivity.length - 1])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(aggregatedActivity) || 1])
      .range([height, 0]);

    const area = d3.area<number>()
      .x((_, i) => x(i))
      .y0(height)
      .y1(d => y(d))
      .curve(d3.curveBasis);

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveBasis);

    // Draw area
    svg.append("path")
      .datum(aggregatedActivity)
      .attr("fill", "url(#velocity-gradient)")
      .attr("d", area);

    // Draw line
    svg.append("path")
      .datum(aggregatedActivity)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8)
      .attr("d", line);

    // Add gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "velocity-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#3b82f6")
      .attr("stop-opacity", 0.2);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#3b82f6")
      .attr("stop-opacity", 0);

  }, [aggregatedActivity, loading]);

  if (loading) {
    return <div className="p-8 text-[10px] font-mono text-zed-muted animate-pulse uppercase tracking-widest text-center">Analyzing team metrics...</div>;
  }

  return (
    <div className="w-full space-y-12">
      {/* Aggregated Velocity Chart */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-zed-border dark:border-zed-dark-border pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zed-muted">Aggregated Project Velocity</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">Peak:</span>
              <span className="text-[10px] font-mono text-zed-text dark:text-zed-dark-text font-bold">
                {Math.max(...aggregatedActivity, 0)} Commits
              </span>
            </div>
            <div className="w-px h-3 bg-zed-border dark:border-zed-dark-border opacity-30" />
            <div className="text-[10px] font-mono text-zed-muted opacity-40 uppercase tracking-tighter">
              {contributors.reduce((acc, c) => acc + c.commitCount, 0)} Total
            </div>
          </div>
        </div>
        
        <div className="relative w-full h-[120px] overflow-hidden group/chart">
          <svg ref={chartRef} className="w-full h-full" preserveAspectRatio="none" />
          
          {/* Subtle Markers */}
          <div className="absolute inset-0 flex items-end justify-between pointer-events-none pb-1 px-1">
            <span className="text-[8px] font-mono font-bold uppercase tracking-tighter text-zed-muted/30">Launch</span>
            <span className="text-[8px] font-mono font-bold uppercase tracking-tighter text-blue-500/40 animate-pulse">Active Now</span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-zed-border/20 dark:divide-zed-dark-border/20">
        <div className="flex items-baseline justify-between border-b border-zed-border dark:border-zed-dark-border pb-2 mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zed-muted">Top Contributors</h2>
          <div className="text-[10px] font-mono text-zed-muted opacity-40">IMPACT RANKING</div>
        </div>
        {contributors.map((author, index) => (
          <div 
            key={author.email} 
            className="group flex items-center gap-6 py-4 hover:bg-zed-bg/50 dark:hover:bg-zed-dark-bg/50 transition-colors duration-150 border-zed-border/10 dark:border-zed-dark-border/10 px-2"
          >
            {/* Minimal Rank */}
            <div className="w-4 text-[10px] font-mono text-zed-muted/40 font-bold">
              {(index + 1).toString().padStart(2, '0')}
            </div>

            {/* Avatar - Tiny & Grayscale */}
            <div className="w-6 h-6 grayscale opacity-40 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300 overflow-hidden rounded-full">
              <Avatar src={author.avatarUrl} name={author.name} className="w-full h-full object-cover" />
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-zed-text dark:text-zed-dark-text truncate tracking-tight">
                {author.name}
              </h3>
              <p className="text-[9px] font-mono text-zed-muted dark:text-zed-dark-muted opacity-50 truncate">
                {author.email}
              </p>
            </div>

            {/* Hyper-Minimalist Activity Chart */}
            <div className="w-32 h-6 flex items-end gap-0.5 opacity-20 group-hover:opacity-60 transition-opacity px-4">
              {(author.activity || []).map((count, i) => {
                const max = Math.max(...(author.activity || [1]), 1);
                const height = (count / max) * 100;
                return (
                  <div 
                    key={i} 
                    className="flex-1 bg-zed-text dark:bg-zed-dark-text" 
                    style={{ height: `${Math.max(10, height)}%` }}
                  />
                );
              })}
            </div>

            {/* Core Stats - Flat */}
            <div className="flex items-center gap-12 text-right pr-4">
              <div className="w-16">
                <div className="text-[11px] font-bold font-mono text-zed-text dark:text-zed-dark-text leading-none">
                  {author.commitCount}
                </div>
                <div className="text-[8px] font-black uppercase tracking-tighter text-zed-muted opacity-40">Commits</div>
              </div>
              
              <div className="w-20">
                <div className="text-[11px] font-bold font-mono text-zed-text dark:text-zed-dark-text leading-none">
                  {author.additions + author.deletions}
                </div>
                <div className="text-[8px] font-black uppercase tracking-tighter text-zed-muted opacity-40">Impact</div>
              </div>

              <div className="w-24 hidden md:block">
                <div className="text-[10px] font-mono text-zed-muted dark:text-zed-dark-muted leading-none">
                  {moment.unix(author.lastCommit).fromNow(true)}
                </div>
                <div className="text-[8px] font-black uppercase tracking-tighter text-zed-muted opacity-40 whitespace-nowrap text-right">Idle</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
