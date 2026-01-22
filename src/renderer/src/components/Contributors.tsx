import React, { useState, useEffect, useRef, useMemo } from "react";
import { ContributorStats } from "@shared/types";
import moment from "moment";
import * as d3 from "d3";
import { Avatar } from "./Avatar";
import { RobotOutlined, SyncOutlined } from "@ant-design/icons";

interface ContributorsProps {
  repoPath: string;
}

export const Contributors: React.FC<ContributorsProps> = ({ repoPath }) => {
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamPulse, setTeamPulse] = useState<string | null>(null);
  const [isPulseLoading, setIsPulseLoading] = useState(false);
  const [workRhythm, setWorkRhythm] = useState<Record<string, { count: number, lastTimestamp: number }>>({});
  const chartRef = useRef<SVGSVGElement | null>(null);
  const rhythmRef = useRef<SVGSVGElement | null>(null);

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

  const fetchTeamPulse = async (stats: ContributorStats[]) => {
    if (stats.length === 0) return;
    setIsPulseLoading(true);
    try {
      // Send a simplified version of stats to the AI
      const simplifiedStats = stats.map(s => ({
        name: s.name,
        commits: s.commitCount,
        impact: s.additions + s.deletions,
        lastCommit: moment.unix(s.lastCommit).fromNow()
      }));
      const pulse = await window.gitcanopyAPI.getTeamPulse(simplifiedStats);
      setTeamPulse(pulse);
    } catch (error) {
      console.error("Failed to fetch team pulse:", error);
    } finally {
      setIsPulseLoading(false);
    }
  };

  useEffect(() => {
    const fetchContributors = async () => {
      setLoading(true);
      try {
        const [contributorData, rhythmData] = await Promise.all([
          window.gitcanopyAPI.getContributors(repoPath),
          window.gitcanopyAPI.getWorkRhythm(repoPath)
        ]);
        setContributors(contributorData);
        setWorkRhythm(rhythmData);
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

  // Render Work Rhythm Heatmap
  useEffect(() => {
    if (loading || !workRhythm || !rhythmRef.current) return;

    const svg = d3.select(rhythmRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 40 };
    const width = rhythmRef.current.clientWidth - margin.left - margin.right;
    const height = 180 - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const xScale = d3.scaleBand()
      .domain(hours.map(String))
      .range([0, width])
      .padding(0.1);

    const yScale = d3.scaleBand()
      .domain(days)
      .range([0, height])
      .padding(0.1);

    const rhythmEntries = Object.values(workRhythm);
    const maxVal = d3.max(rhythmEntries, d => d.count) || 1;
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxVal])
      .range([0, xScale.bandwidth() / 2]);

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxVal]);

    // Create Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "fixed pointer-events-none bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-2 py-1.5 rounded shadow-xl text-[10px] font-mono z-[100] opacity-0 transition-opacity duration-200");

    // X-Axis (Hours)
    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).tickValues(["0", "6", "12", "18", "23"]))
      .attr("class", "text-[8px] opacity-40")
      .select(".domain").remove();

    // Y-Axis (Days)
    g.append("g")
      .call(d3.axisLeft(yScale))
      .attr("class", "text-[8px] opacity-40 font-bold")
      .select(".domain").remove();

    // Data points
    Object.entries(workRhythm).forEach(([key, data]) => {
      const [dayIdx, hour] = key.split("-");
      const day = days[parseInt(dayIdx)];
      const hourLabel = parseInt(hour) >= 12 ? (parseInt(hour) === 12 ? "12 PM" : `${parseInt(hour)-12} PM`) : (parseInt(hour) === 0 ? "12 AM" : `${hour} AM`);
      const formattedDate = moment.unix(data.lastTimestamp).format("MMM D, YYYY");
      
      g.append("circle")
        .attr("cx", (xScale(hour) || 0) + xScale.bandwidth() / 2)
        .attr("cy", (yScale(day) || 0) + yScale.bandwidth() / 2)
        .attr("r", radiusScale(data.count))
        .attr("fill", colorScale(data.count))
        .attr("opacity", 0.8)
        .attr("class", "cursor-crosshair transition-all duration-200")
        .on("mouseenter", function(_event) {
          d3.select(this)
            .attr("opacity", 1)
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 1.5);
            
          tooltip
            .style("opacity", 1)
            .html(`
              <div class="flex flex-col gap-1 min-w-[120px]">
                <div class="flex items-center justify-between">
                  <span class="text-zed-muted uppercase font-bold text-[8px]">${day} @ ${hourLabel}</span>
                  <span class="text-zed-accent font-black">${data.count} COMMITS</span>
                </div>
                <div class="h-px bg-zed-border/30 w-full"></div>
                <div class="flex items-center justify-between text-[8px] opacity-60">
                  <span>LATEST ACTIVITY:</span>
                  <span class="font-bold">${formattedDate}</span>
                </div>
              </div>
            `);
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 12) + "px");
        })
        .on("mouseleave", function() {
          d3.select(this)
            .attr("opacity", 0.8)
            .attr("stroke", "none");
          tooltip.style("opacity", 0);
        });
    });

    return () => {
      tooltip.remove();
    };

  }, [workRhythm, loading]);

  if (loading) {
    return <div className="p-8 text-[10px] font-mono text-zed-muted animate-pulse uppercase tracking-widest text-center">Analyzing team metrics...</div>;
  }

  return (
    <div className="w-full space-y-12">
      {/* Hyper-Minimalist AI Team Pulse */}
      <div className="border-l-2 border-zed-accent pl-6 py-1 space-y-3 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RobotOutlined className="text-zed-accent text-xs" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zed-muted">Team Pulse</h3>
          </div>
          {!teamPulse && !isPulseLoading && (
            <button 
              onClick={() => fetchTeamPulse(contributors)}
              className="text-[9px] font-black uppercase tracking-widest text-zed-accent hover:underline decoration-2 underline-offset-4 transition-all"
            >
              AI Analyse
            </button>
          )}
          {(teamPulse || isPulseLoading) && (
            <span className="text-[8px] font-mono text-zed-muted opacity-30 uppercase tracking-tighter">
              Gemini Contextual Engine
            </span>
          )}
        </div>
        
        {isPulseLoading ? (
          <div className="flex items-center gap-3">
            <SyncOutlined spin className="text-[10px] text-zed-accent opacity-50" />
            <div className="h-px w-12 bg-zed-accent/20 animate-pulse" />
            <span className="text-[9px] font-mono text-zed-muted uppercase tracking-widest opacity-50">
              Synthesizing metrics...
            </span>
          </div>
        ) : teamPulse ? (
          <p className="text-[13px] leading-relaxed text-zed-text dark:text-zed-dark-text font-medium max-w-3xl animate-in fade-in slide-in-from-left-2 duration-700">
            {teamPulse}
          </p>
        ) : (
          <p className="text-[11px] text-zed-muted opacity-40 italic">
            Select analyze to interpret team distribution and velocity health.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Aggregated Velocity Chart */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-zed-border dark:border-zed-dark-border pb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zed-muted">Project Velocity</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">Peak:</span>
                <span className="text-[10px] font-mono text-zed-text dark:text-zed-dark-text font-bold">
                  {Math.max(...aggregatedActivity, 0)}
                </span>
              </div>
              <div className="w-px h-3 bg-zed-border dark:border-zed-dark-border opacity-30" />
              <div className="text-[10px] font-mono text-zed-muted opacity-40 uppercase tracking-tighter">
                {contributors.reduce((acc, c) => acc + c.commitCount, 0)} Total
              </div>
            </div>
          </div>
          <div className="relative w-full h-[140px] overflow-hidden group/chart">
            <svg ref={chartRef} className="w-full h-full" preserveAspectRatio="none" />
            <div className="absolute inset-0 flex items-end justify-between pointer-events-none pb-1 px-1">
              <span className="text-[8px] font-mono font-bold uppercase tracking-tighter text-zed-muted/30">Launch</span>
              <span className="text-[8px] font-mono font-bold uppercase tracking-tighter text-blue-500/40 animate-pulse">Active Now</span>
            </div>
          </div>
        </div>

        {/* Work Rhythm Heatmap */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-zed-border dark:border-zed-dark-border pb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zed-muted">Work Rhythm</h2>
            <div className="text-[9px] font-mono text-zed-muted opacity-40 uppercase">Commit Density (Day/Hour)</div>
          </div>
          <div className="relative w-full h-[140px] overflow-hidden">
            <svg ref={rhythmRef} className="w-full h-full" />
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
