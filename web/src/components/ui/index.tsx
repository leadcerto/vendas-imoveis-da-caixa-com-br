'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ 
  children, 
  variant = 'primary', 
  loading, 
  icon, 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseStyles = "px-6 py-4 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-[#005CA9] hover:bg-[#003870] text-white shadow-[#005CA9]/10",
    danger: "bg-red-50 border border-red-100 text-red-600 hover:bg-red-100",
    ghost: "bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-[#005CA9]",
    outline: "bg-white border border-gray-200 text-[#005CA9] hover:border-[#005CA9] hover:bg-blue-50"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin"></div>
      ) : (
        <>
          {children}
          {icon}
        </>
      )}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({ label, icon, rightElement, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-2 w-full">
      {label && <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#005CA9] ml-4">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#005CA9] transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`w-full bg-white border border-gray-200 rounded-2xl py-4 ${icon ? 'pl-14' : 'pl-6'} ${rightElement ? 'pr-14' : 'pr-6'} text-[#111827] text-sm focus:border-[#005CA9] transition-all outline-none placeholder:text-gray-400 shadow-sm ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

export function Card({ children, className = '', hoverGlow = false }: { children: React.ReactNode, className?: string, hoverGlow?: boolean }) {
  return (
    <div className={`bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all ${className}`}>
      {hoverGlow && (
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[#005CA9]/5 blur-[60px] rounded-full group-hover:bg-[#005CA9]/10 transition-all pointer-events-none"></div>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
