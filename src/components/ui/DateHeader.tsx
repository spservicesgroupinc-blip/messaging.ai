import React from 'react';

export interface DateHeaderProps { date: string }

export const DateHeader: React.FC<DateHeaderProps> = ({ date }) => {
  const value = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  const label = day.getTime() === today.getTime() ? 'Today'
    : day.getTime() === yesterday.getTime() ? 'Yesterday'
    : value.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(value.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}) });
  return (
    <div className='my-5 flex w-full items-center px-4 sm:px-6'>
      <div className='flex-1 border-t border-[#e5e7e9]' />
      <time dateTime={date} className='rounded-full border border-[#e5e7e9] bg-white px-3 py-1 text-[11px] font-semibold text-[#575e63]'>
        {label}
      </time>
      <div className='flex-1 border-t border-[#e5e7e9]' />
    </div>
  );
};
