// src/theme/themes.js

export const THEMES = {
  qminds: {
    id: "qminds",
    label: "Qminds OSINT",
    banner: String.raw`
   ____       _                       _       
  / __ \ ___ (_)____ _   ____  ____  (_)___ _
 / / / // _ \/ // __ \ / __ \/ __ \/ // _ \/
/ /_/ //  __/ // / / // /_/ / / / / //  __/
/_____/ \___/_//_/ /_(_)____/_/ /_/_/ \___/ 

        Qminds OSINT Terminal v0.1
`,
    colors: {
      // Header
      headerText: "text-green-300/70",
      headerSubText: "text-green-400/80",
      headerMetricsText: "text-green-400/60",
      netBar: "bg-green-500/80",

      // General
      bannerText: "text-green-400/90",
      bodyText: "text-green-100",

      // Prompt / output
      promptUser: "text-green-300",
      promptPath: "text-green-500",
      promptSymbol: "text-green-300",

      // 👇 mientras escribes (antes de Enter) —> como tu ejemplo: text-green-400
      commandInput: "text-green-400",

      // 👇 cuando ya quedó en el history —> como tu ejemplo: text-green-100
      commandHistory: "text-green-400",

      outputText: "text-green-200",
      errorText: "text-red-400",
    },
  },

  darknet: {
    id: "darknet",
    label: "Darknet Recon",
    banner: String.raw`                     
                                           
                                                           @@@@@@@@@@@@@@@@@@@@@@@@@@    
                                                  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     
                                            @@@@@@@@@@@@@@@@@@@@@@@@%%%###@###%@@@@@     
                                       @@@@@@@@@@@@@@@@@@%@@#######%@#####@####@@@@      
                                  @@@@@@@@@@@@@@@%@%*######%%*#####*@%#####%##%@@@@      
                              @@@@@@@@@@@@@%#######%@#######@#######%@**##*@##@@@@       
                           @@@@@@@@@@@%####*#########%##**+++@=======@+=*##%#@@@@        
                         @@@@@@@@%@%############**+++#*======%+======%*=###%@@@@@        
                      @@@@@@@@%###@*######@@@@#++++++*%======*#======##=*#*@@@@@         
                    @@@@@@@@######@###*++#@@@@@++++++*@======*#======#*+##@@@@@          
                 @@@@@@@%##@######@+++++++#@@%*++++++##======#+======#+*#%@@@@           
                @@@@@@#*###@###+==+%+++++++++++++++++@=======@=======%+#%@@@@            
              @@@@@%@######@+======*#+++++++++++++++#*======+#======+##%@@@@             
            @@@@@@##@####+=+%=======+%++++++++++++*@+=======%=======%#@@@@@              
           @@@@@####%@#+====*%========*@#++++++*%%+========%=======#@@@@@@               
         @@@@@%######@+======+%===========================@=======*@@@@@                 
        @@@@@#%####+==@========%*=======================#*======+@@@@@@                  
       @@@@###%##+=====%*========%#===================##======*@@@@@@                    
      @@@@#####%========+%=========*%%*============*%+====+#@@@@@@@                      
     @@@@##*#+==#=========+%===========+*#%%%%%%*+====+%@@@@@@@@                         
    @@@%@##*=====*+=========+@*================+*%@@@@@@@@@@                             
   @@@%##%========+%===========*@#++##%%@@@@@@@@@@@@@@@                                  
  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                                         
  @@@@@@@@@@                                                                                

        Rinnegan OSINT Terminal Tool
`,
    colors: {
      headerText: "text-[#c8ff2f]/70",
      headerSubText: "text-[#c8ff2f]/80",
      headerMetricsText: "text-[#c8ff2f]/60",
      netBar: "bg-[#c8ff2f]/80",

      bannerText: "text-[#c8ff2f]",
      bodyText: "text-[#c8ff2f]/90",

      promptUser: "text-[#ff004d]",
      promptPath: "text-[#c8ff2f]/60",
      promptSymbol: "text-[#c8ff2f]",

      commandInput: "text-[#c8ff2f]",
      commandHistory: "text-[#c8ff2f]",

      outputText: "text-[#c8ff2f]/80",
      errorText: "text-[#ff004d]",
    },
  },

  cloud: {
    id: "cloud",
    label: "Cloud Hunter",
    banner: String.raw`
   _____ _                 _   _             _            
  / ____| |               | | | |           | |           
 | |    | | ___  _   _  __| | | |__  _   _  | |_ ___ _ __ 
 | |    | |/ _ \| | | |/ _\` | | '_ \| | | | | __/ _ \ '__|
 | |____| | (_) | |_| | (_| | | |_) | |_| | | ||  __/ |   
  \_____|_|\___/ \__,_|\__,_| |_.__/ \__, |  \__\___|_|   
                                     __/ |               
                                    |___/                

        Cloud Hunter Panel
`,
    colors: {
      headerText: "text-cyan-300/80",
      headerSubText: "text-cyan-400/80",
      headerMetricsText: "text-cyan-400/60",
      netBar: "bg-cyan-500/80",

      bannerText: "text-cyan-400/90",
      bodyText: "text-cyan-100",

      promptUser: "text-cyan-300",
      promptPath: "text-cyan-500",
      promptSymbol: "text-cyan-300",

      // typing
      commandInput: "text-cyan-400",
      // history
      commandHistory: "text-cyan-400",

      outputText: "text-cyan-200",
      errorText: "text-red-400",
    },
  },
};

export const AVAILABLE_THEMES = Object.values(THEMES).map((t) => ({
  id: t.id,
  label: t.label,
}));
