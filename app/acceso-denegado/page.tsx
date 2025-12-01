export default function AccesoDenegado() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <div className="max-w-md p-8 text-center bg-white rounded-lg shadow dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
          Acceso denegado
        </h1>
        <div className="mt-4 space-y-3 text-gray-700 dark:text-gray-300">
          <p>
            Si sos proveedor y te registraste desde la app, sólo tenés permisos para operar allí.
          </p>
          <p>
            Si sos parte del equipo de Incluir Salud y te registraste desde la web, comunicate con un administrador para que te asigne el rol correspondiente al backoffice.
          </p>
        </div>
      </div>
    </div>
  );
}
