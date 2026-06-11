using System;
using System.Diagnostics;
using System.IO;

class Program
{
    static void Main()
    {
        // Caminho para a pasta do seu projeto
        string projectPath = @"D:\MyProjs_Temp\minIONavigator";
        
        ProcessStartInfo startInfo = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            // /C executa o comando e termina. npm start inicia o servidor.
            Arguments = "/c npm start",
            WorkingDirectory = projectPath,
            WindowStyle = ProcessWindowStyle.Hidden, // Esconde a janela
            CreateNoWindow = true,                   // Garante que nenhuma janela seja criada
            UseShellExecute = false                  // Necessário para CreateNoWindow funcionar
        };

        try
        {
            Process.Start(startInfo);
        }
        catch (Exception ex)
        {
            // Caso ocorra erro, você pode logar em um arquivo
            File.WriteAllText(Path.Combine(projectPath, "error_log.txt"), ex.Message);
        }
    }
}