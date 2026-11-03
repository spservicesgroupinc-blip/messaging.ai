import React from 'react';

export interface DateHeaderProps {
  date: string;
}

const MONTHS: string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DateHeader: React.FC<DateHeaderProps> = ({ date }) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const headerDate = new Date(d);
  headerDate.setHours(0, 0, 0, 0);

  let label: string;
  if (headerDate.getTime() === today.getTime()) {
    label = 'Today';
  } else if (headerDate.getTime() === yesterday.getTime()) {
    label = 'Yesterday';
  } else {
    label = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  return (
    <div className="relative w-full flex items-center gap-3 my-4 text-center">
      <div className="flex-1 border-t border-slate-200" />
      <span className="whitespace-nowrap text-xs font-medium text-slate-400 bg-transparent px-2">
        {label}
      </span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
};
