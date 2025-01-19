import React from 'react';

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow-md ${className}`}>{children}</div>
);

export const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-bold mb-4">{children}</h2>
);

export const CardContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6">{children}</div>
);