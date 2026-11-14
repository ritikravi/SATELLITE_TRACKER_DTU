'use client';

import React from 'react';
import Link from 'next/link';
import { Satellite, ChevronRight } from '@/components/ui/icons';

const BOM_ITEMS = [
  { item: 'ESP32-WROOM-32 DevKit', qty: '1', cost: 400, notes: 'Dual-core 240MHz, 2.4GHz Wi-Fi/BT' },
  { item: '28BYJ-48 Steppers (5V unipolar)', qty: '2', cost: 200, notes: '~4076 half-steps/rev via internal ~1:64 gearbox' },
  { item: 'ULN2003 Driver Modules', qty: '2', cost: 90, notes: 'Darlington array (external 5V rail)' },
  { item: '608ZZ Bearings (8x22x7 mm)', qty: '4', cost: 135, notes: 'Dual bearings per axis for radial load' },
  { item: 'MPU-6050 (GY-521) IMU', qty: '1', cost: 141, notes: 'I2C static leveling on startup' },
  { item: 'USB Cable & 5V 2A Power Supply', qty: '1', cost: 100, notes: 'Supplies steppers & dev board' },
  { item: 'Mechanical Limit Switches', qty: '4', cost: 40, notes: 'Endstops for position reset' },
  { item: 'Jumper Wires & Connectors', qty: '1 set', cost: 50, notes: 'Hookup wiring' },
  { item: 'PLA 3D Printing Filament', qty: '~350g', cost: 100, notes: 'Stratos-based frame & 3.57:1 gearsets' },
  { item: 'M3/M4 Screws & Hardware', qty: 'Assorted', cost: 50, notes: 'Fasteners & standoffs' },
];

const TOTAL_BOM_COST = BOM_ITEMS.reduce((acc, curr) => acc + curr.cost, 0);

const ROADMAP_STEPS = [
  { milestone: 'Phase 1', title: 'Design & 3D Printing', desc: 'Chassis and 3.57:1 gearsets printed in PLA with 608ZZ bearings.', status: 'Completed' },
  { milestone: 'Phase 2', title: 'Electronics & Sensors', desc: 'Breadboard wiring with ULN2003 drivers and MPU-6050 level sensor.', status: 'Completed' },
  { milestone: 'Phase 3', title: 'Firmware Core', desc: 'SGP4 satellite orbital calculations, Wi-Fi web server, and motor control.', status: 'In Progress' },
  { milestone: 'Phase 4', title: 'Bench Validation', desc: 'Simulate satellite passes and fine-tune step calibration.', status: 'Upcoming' },
  { milestone: 'Phase 5', title: 'Field Trials', desc: 'Track real NavIC satellites with patch antenna outdoors.', status: 'Upcoming' },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold mb-3 shadow-2xs">
          <Satellite className="w-3.5 h-3.5 text-sky-600" /> Project Background & Specs
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">About NAVIC-TRACK</h1>
        <p className="text-slate-600 mt-2 text-base leading-relaxed">
          NAVIC-TRACK is an ultra-low-cost, motorized 2-axis mount that aims antennas directly at satellites
          (specifically India&apos;s NavIC / IRNSS constellation) so you can receive satellite signals reliably.
        </p>
      </div>

      {/* Bill of Materials Table */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Parts & Estimated Cost</h2>
            <p className="text-xs text-slate-500">Total hardware cost is kept under ₹1,300 using standard, easy-to-source parts.</p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold self-start sm:self-auto shadow-2xs">
            Total Cost: ~₹{TOTAL_BOM_COST.toLocaleString()}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase">
                <th className="py-2.5 px-3">Part</th>
                <th className="py-2.5 px-3">Quantity</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {BOM_ITEMS.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{item.item}</td>
                  <td className="py-2.5 px-3 text-slate-500">{item.qty}</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-600">₹{item.cost}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-500">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Project Roadmap */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Project Roadmap</h2>
        <div className="space-y-3">
          {ROADMAP_STEPS.map((step, idx) => (
            <div key={idx} className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                step.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                step.status === 'In Progress' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                'bg-slate-200 text-slate-600'
              }`}>
                {step.status}
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{step.milestone}: {step.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 underline font-semibold"
        >
          &larr; Back to Home
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-sky-500/15"
        >
          <span>Open Dashboard</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
