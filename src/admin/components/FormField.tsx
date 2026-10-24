interface Props {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, error, required, children }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function AdminInput({ error, className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full bg-gray-800/60 border ${error ? 'border-red-500/60' : 'border-cyan-300/20'} text-white text-sm rounded-xl px-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 focus:bg-gray-800/80 transition-all ${className}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function AdminSelect({ error, className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full bg-gray-800/60 border ${error ? 'border-red-500/60' : 'border-cyan-300/20'} text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60 focus:bg-gray-800/80 transition-all ${className}`}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function AdminTextarea({ error, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full bg-gray-800/60 border ${error ? 'border-red-500/60' : 'border-cyan-300/20'} text-white text-sm rounded-xl px-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-cyan-400/60 focus:bg-gray-800/80 transition-all resize-none ${className}`}
    />
  );
}
