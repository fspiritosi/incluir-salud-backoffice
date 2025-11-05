export default function AccesoDenegado() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <div className="max-w-md p-8 text-center bg-white rounded-lg shadow dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
          Acceso denegado
        </h1>
        <p className="mt-4 text-gray-700 dark:text-gray-300">
          No tienes un rol permitido para ingresar al sistema.
        </p>
      </div>
    </div>
  );
}
