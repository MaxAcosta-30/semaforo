# Caso 2 en interfaz: registrar producto

- **Pantalla:** `/productos/nuevo`. Sin sesión redirige a `/entrar`; lector y demo ven "solo lectura" sin formulario (prueba e2e). La API sigue siendo la que decide (401/403).
- **Esquema compartido:** `src/lib/productos/esquema.ts` solo importa Zod, así el navegador valida con las mismas reglas sin cargar la base ni el DNS. `registro.ts` y `github/cliente.ts` lo re-exportan. El slug `nuevo` queda reservado (la ruta lo taparía).
- **Formulario:** slug automático desde el nombre hasta que se edita a mano; 1 a 5 endpoints; errores junto a su campo (`aria-invalid`, `aria-describedby`) y foco al primero; el error SSRF que devuelve el servidor aparece junto a la URL.
- **Error encontrado en el navegador:** quitar el error en el blur movía el botón bajo el cursor y el clic de "Registrar" se perdía. Ahora el error se borra al escribir y el blur solo agrega.
- **Verificado en local (build de producción):** recorrido como admin (vacío → errores, 127.0.0.1 → error SSRF, URL pública → 201 y redirige al detalle); axe 0 en claro y oscuro a 390 y 1440 px. 147 pruebas de integración/unitarias y 3 e2e en verde.
- **NO VERIFICADO:** con una sesión real de GitHub (falta la OAuth App).
